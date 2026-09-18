'use strict';

const { getSupabaseClient } = require('./supabase-client');

const CORE_CONTRACT_VERSION = '0.1.0';

function coreClient(client = getSupabaseClient()) {
  if (!client || typeof client.schema !== 'function') {
    throw new TypeError('El cliente Supabase del anfitrión debe soportar schema()');
  }
  return client.schema('core');
}

function bearerToken(request) {
  const value = request?.headers?.authorization || request?.headers?.Authorization;
  if (!value || typeof value !== 'string') return null;
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

async function resolveIdentity(request, client = getSupabaseClient()) {
  const token = bearerToken(request);
  if (!token || !client.auth || typeof client.auth.getUser !== 'function') return null;
  const result = await client.auth.getUser(token);
  if (result.error || !result.data?.user?.id) return null;
  return { userId: result.data.user.id, externalSubject: result.data.user.id };
}

function requestedTenant(request) {
  const headers = request?.headers || {};
  return {
    organizationId: headers['x-organization-id'] || headers['X-Organization-Id'] || null,
    siteId: headers['x-site-id'] || headers['X-Site-Id'] || null,
  };
}

async function fetchOne(query) {
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data || null;
}

async function ensureUserProfile(identity, displayName, client = getSupabaseClient()) {
  const core = coreClient(client);
  let profile = await fetchOne(core.from('user_profiles').select('*').eq('external_subject', identity.externalSubject));
  if (!profile) {
    const inserted = await core.from('user_profiles').insert({
      id: identity.userId,
      external_subject: identity.externalSubject,
      display_name: displayName || identity.externalSubject,
    }).select('*').single();
    if (inserted.error) throw inserted.error;
    profile = inserted.data;
  }
  return profile;
}

async function createOrganization(name, actorUserId, client = getSupabaseClient()) {
  const core = coreClient(client);
  const result = await core.from('organizations').insert({ name, }).select('*').single();
  if (result.error) throw result.error;
  await recordAudit({ action: 'organization.created', actorUserId, organizationId: result.data.id, outcome: 'success' }, client);
  return result.data;
}

async function listOrganizations(userId, client = getSupabaseClient()) {
  const core = coreClient(client);
  const { data, error } = await core.from('organizations').select('*,organization_memberships!inner(user_id,active)').eq('organization_memberships.user_id', userId).eq('organization_memberships.active', true).eq('active', true);
  if (error) throw error;
  return data || [];
}

async function listSites(userId, organizationId, client = getSupabaseClient()) {
  const core = coreClient(client);
  const memberships = await core.from('organization_memberships').select('id').eq('user_id', userId).eq('organization_id', organizationId).eq('active', true);
  if (memberships.error) throw memberships.error;
  const membershipIds = (memberships.data || []).map((row) => row.id);
  if (!membershipIds.length) return [];
  const access = await core.from('site_access').select('site_id').in('membership_id', membershipIds).eq('active', true);
  if (access.error) throw access.error;
  const siteIds = (access.data || []).map((row) => row.site_id);
  if (!siteIds.length) return [];
  const sites = await core.from('sites').select('*').in('id', siteIds).eq('organization_id', organizationId).eq('active', true);
  if (sites.error) throw sites.error;
  return sites.data || [];
}

async function listMemberships(userId, client = getSupabaseClient()) {
  const core = coreClient(client);
  const result = await core.from('organization_memberships').select('*').eq('user_id', userId).eq('active', true);
  if (result.error) throw result.error;
  return result.data || [];
}

async function listRoles(organizationId, client = getSupabaseClient()) {
  const core = coreClient(client);
  const result = await core.from('roles').select('*').eq('organization_id', organizationId).eq('active', true);
  if (result.error) throw result.error;
  return result.data || [];
}

async function listPermissions(client = getSupabaseClient()) {
  const core = coreClient(client);
  const result = await core.from('permissions').select('*').eq('active', true);
  if (result.error) throw result.error;
  return result.data || [];
}

async function createSite(organizationId, name, actorUserId, client = getSupabaseClient()) {
  const core = coreClient(client);
  const result = await core.from('sites').insert({ organization_id: organizationId, name }).select('*').single();
  if (result.error) throw result.error;
  await recordAudit({ action: 'site.created', actorUserId, organizationId, siteId: result.data.id, outcome: 'success' }, client);
  return result.data;
}

async function upsertMembership(userId, organizationId, client = getSupabaseClient()) {
  const core = coreClient(client);
  const result = await core.from('organization_memberships').upsert({ user_id: userId, organization_id: organizationId, active: true }, { onConflict: 'user_id,organization_id' }).select('*').single();
  if (result.error) throw result.error;
  await recordAudit({ action: 'membership.created', actorUserId: userId, organizationId, outcome: 'success', metadata: { membershipId: result.data.id } }, client);
  return result.data;
}

async function grantSiteAccess(membershipId, siteId, organizationId, actorUserId, client = getSupabaseClient()) {
  const core = coreClient(client);
  const membership = await fetchOne(core.from('organization_memberships').select('id,organization_id').eq('id', membershipId));
  const site = await fetchOne(core.from('sites').select('id,organization_id').eq('id', siteId));
  if (!membership || !site || membership.organization_id !== organizationId || site.organization_id !== organizationId) {
    throw new Error('site access must remain inside the selected organization');
  }
  const result = await core.from('site_access').upsert({ membership_id: membershipId, site_id: siteId, active: true }, { onConflict: 'membership_id,site_id' }).select('*').single();
  if (result.error) throw result.error;
  await recordAudit({ action: 'membership.site_access_granted', actorUserId, organizationId, siteId, outcome: 'success' }, client);
  return result.data;
}

async function authorize(context, permissionCode, client = getSupabaseClient()) {
  const core = coreClient(client);
  const siteRelation = context.siteId ? 'site_access!inner(site_id,active)' : 'site_access(site_id,active)';
  let query = core.from('organization_memberships').select(`id,user_id,organization_id,active,${siteRelation},membership_roles!inner(role_id,roles!inner(organization_id,active,permission_codes))`).eq('user_id', context.userId).eq('organization_id', context.organizationId).eq('active', true);
  if (context.siteId) query = query.eq('site_access.site_id', context.siteId).eq('site_access.active', true);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  const roleLinks = data?.membership_roles || [];
  const allowed = Boolean(data && roleLinks.some((link) => link.roles?.organization_id === context.organizationId && link.roles?.active && (link.roles.permission_codes || []).includes(permissionCode)));
  const reason = allowed ? 'permission granted' : (!data ? 'active membership and site access required' : 'permission denied');
  await recordAudit({ action: 'authorization.checked', actorUserId: context.userId, organizationId: context.organizationId, siteId: context.siteId, outcome: allowed ? 'allowed' : 'denied', metadata: { permission: permissionCode, reason } }, client);
  return { contractVersion: CORE_CONTRACT_VERSION, allowed, reason, context };
}

async function buildTenantContext(request, permissionCode, client = getSupabaseClient()) {
  const identity = await resolveIdentity(request, client);
  const tenant = requestedTenant(request);
  if (!identity || !tenant.organizationId) {
    return { identity, context: null, authorization: { contractVersion: CORE_CONTRACT_VERSION, allowed: false, reason: 'identity and organization context required', context: null } };
  }
  const context = { userId: identity.userId, organizationId: tenant.organizationId, siteId: tenant.siteId };
  const authorization = await authorize(context, permissionCode, client);
  return { identity, context, authorization };
}

async function recordAudit(event, client = getSupabaseClient()) {
  const core = coreClient(client);
  const result = await core.from('audit_events').insert({
    action: event.action,
    actor_user_id: event.actorUserId || null,
    organization_id: event.organizationId || null,
    site_id: event.siteId || null,
    outcome: event.outcome,
    metadata: event.metadata || {},
  });
  if (result.error) throw result.error;
}

module.exports = {
  CORE_CONTRACT_VERSION,
  authorize,
  buildTenantContext,
  createOrganization,
  createSite,
  ensureUserProfile,
  grantSiteAccess,
  listOrganizations,
  listPermissions,
  listMemberships,
  listRoles,
  listSites,
  recordAudit,
  resolveIdentity,
  upsertMembership,
};
