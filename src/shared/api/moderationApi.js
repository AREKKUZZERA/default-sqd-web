import { isSupabaseConfigured, supabase } from '../lib/supabase.js';
import { getDisplayRole, getPermissions } from '../utils/permissions.js';

const getErrorMessage = (error) => error?.message || 'Moderation request failed';

const mapReport = (report = {}) => {
  const targetProfile = {
    permissions: report.target_permissions || [],
    role: report.target_role || '',
  };

  return {
    id: report.id,
    reporterId: report.reporter_id,
    reporterName: report.reporter_name || '',
    reporterUserId: report.reporter_user_id || '',
    targetId: report.target_id,
    targetName: report.target_name || '',
    targetUserId: report.target_user_id || '',
    targetRole: getDisplayRole(targetProfile),
    targetPermissions: getPermissions(targetProfile),
    postId: report.post_id,
    commentId: report.comment_id,
    messageId: report.message_id,
    contentType: report.content_type || '',
    contentText: report.content_text || '',
    contentAuthorId: report.content_author_id || '',
    contentAuthorName: report.content_author_name || '',
    contentAuthorUserId: report.content_author_user_id || '',
    contentCreatedAt: report.content_created_at || null,
    reason: report.reason || '',
    status: report.status || 'open',
    createdAt: report.created_at,
  };
};

export async function blockUser(targetUserId, reason = '') {
  if (!isSupabaseConfigured || !targetUserId) return;

  const { error } = await supabase.rpc('block_user', {
    reason,
    target_user_id: targetUserId,
  });

  if (error) throw new Error(getErrorMessage(error));
}

export async function unblockUser(targetUserId) {
  if (!isSupabaseConfigured || !targetUserId) return;

  const { error } = await supabase.rpc('unblock_user', {
    target_user_id: targetUserId,
  });

  if (error) throw new Error(getErrorMessage(error));
}

export async function reportContent({ commentId = null, messageId = null, postId = null, reason = '', targetUserId = null } = {}) {
  if (!isSupabaseConfigured) return;

  const { error } = await supabase.rpc('report_content', {
    report_reason: reason,
    target_comment_id: commentId,
    target_message_id: messageId,
    target_post_id: postId,
    target_user_id: targetUserId,
  });

  if (error) throw new Error(getErrorMessage(error));
}

export async function applyModerationAction({ action, expiresAt = null, reason = '', targetUserId }) {
  if (!isSupabaseConfigured || !targetUserId || !action) return;

  const { error } = await supabase.rpc('apply_moderation_action', {
    action_name: action,
    expires_at: expiresAt,
    reason,
    target_user_id: targetUserId,
  });

  if (error) throw new Error(getErrorMessage(error));
}

export async function fetchModerationReports() {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase.rpc('list_moderation_reports');

  if (error) throw new Error(getErrorMessage(error));

  return (data || []).map(mapReport);
}

export async function updateReportStatus(reportId, status) {
  if (!isSupabaseConfigured || !reportId || !status) return;

  const { error } = await supabase.rpc('set_report_status', {
    next_status: status,
    report_id: reportId,
  });

  if (error) throw new Error(getErrorMessage(error));
}
