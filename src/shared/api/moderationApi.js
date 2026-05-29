import { isSupabaseConfigured, supabase } from '../lib/supabase.js';

const getErrorMessage = (error) => error?.message || 'Moderation request failed';

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
