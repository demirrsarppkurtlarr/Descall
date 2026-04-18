const express = require("express");
const supabase = require("../db/supabase");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
const MAX_GROUP_SIZE = 15;

// Get all groups where user is member
router.get("/my", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const { data: groups, error } = await supabase
      .from("group_members")
      .select(`
        groups:group_id (id, name, avatar_url, created_by, created_at),
        joined_at
      `)
      .eq("user_id", userId);
    
    if (error) return res.status(500).json({ error: "Failed to fetch groups" });
    
    // Get member counts for each group
    const groupIds = groups.map(g => g.groups.id);
    const { data: memberCounts } = await supabase
      .from("group_members")
      .select("group_id, count")
      .in("group_id", groupIds)
      .group("group_id");
    
    const countsMap = new Map((memberCounts || []).map(m => [m.group_id, m.count]));
    
    const enriched = groups.map(g => ({
      ...g.groups,
      joinedAt: g.joined_at,
      memberCount: countsMap.get(g.groups.id) || 0,
    }));
    
    res.json({ groups: enriched });
  } catch (err) {
    console.error("[Groups] List error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

// Create new group
router.post("/create", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, memberIds = [] } = req.body;
    
    if (!name || name.trim().length < 2 || name.length > 50) {
      return res.status(400).json({ error: "Group name must be 2-50 characters" });
    }
    
    const totalMembers = memberIds.length + 1; // + creator
    if (totalMembers > MAX_GROUP_SIZE) {
      return res.status(400).json({ error: `Maximum ${MAX_GROUP_SIZE} members allowed` });
    }
    
    // Create group
    const { data: group, error: createError } = await supabase
      .from("groups")
      .insert({ name: name.trim(), created_by: userId })
      .select()
      .single();
    
    if (createError) throw createError;
    
    // Add creator as member
    const allMembers = [userId, ...memberIds.filter(id => id !== userId)].slice(0, MAX_GROUP_SIZE);
    const memberRows = allMembers.map(user_id => ({ group_id: group.id, user_id }));
    
    const { error: memberError } = await supabase
      .from("group_members")
      .insert(memberRows);
    
    if (memberError) throw memberError;
    
    res.json({ 
      message: "Group created", 
      group: { ...group, memberCount: allMembers.length } 
    });
  } catch (err) {
    console.error("[Groups] Create error:", err);
    res.status(500).json({ error: "Failed to create group" });
  }
});

// Get group messages
router.get("/:groupId/messages", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { groupId } = req.params;
    const { before, limit = 50 } = req.query;
    
    // Check membership
    const { data: member } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("group_id", groupId)
      .eq("user_id", userId)
      .maybeSingle();
    
    if (!member) return res.status(403).json({ error: "Not a member of this group" });
    
    let query = supabase
      .from("group_messages")
      .select(`
        *,
        sender:sender_id (id, username, avatar_url)
      `)
      .eq("group_id", groupId)
      .order("created_at", { ascending: false })
      .limit(parseInt(limit));
    
    if (before) {
      query = query.lt("created_at", before);
    }
    
    const { data: messages, error } = await query;
    if (error) throw error;
    
    res.json({ messages: (messages || []).reverse() });
  } catch (err) {
    console.error("[Groups] Messages error:", err);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// Send message to group
router.post("/:groupId/messages", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { groupId } = req.params;
    const { content, mediaUrl, mediaType } = req.body;
    
    if (!content?.trim() && !mediaUrl) {
      return res.status(400).json({ error: "Message content or media required" });
    }
    
    // Check membership
    const { data: member } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("group_id", groupId)
      .eq("user_id", userId)
      .maybeSingle();
    
    if (!member) return res.status(403).json({ error: "Not a member" });
    
    const { data: message, error } = await supabase
      .from("group_messages")
      .insert({
        group_id: groupId,
        sender_id: userId,
        content: content?.trim() || null,
        media_url: mediaUrl || null,
        media_type: mediaType || null,
      })
      .select(`*, sender:sender_id (id, username, avatar_url)`)
      .single();
    
    if (error) throw error;
    
    res.json({ message });
  } catch (err) {
    console.error("[Groups] Send error:", err);
    res.status(500).json({ error: "Failed to send message" });
  }
});

// Get group members
router.get("/:groupId/members", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { groupId } = req.params;
    
    // Check membership
    const { data: myMembership } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("group_id", groupId)
      .eq("user_id", userId)
      .maybeSingle();
    
    if (!myMembership) return res.status(403).json({ error: "Not a member" });
    
    const { data: members, error } = await supabase
      .from("group_members")
      .select(`
        joined_at,
        user:user_id (id, username, avatar_url)
      `)
      .eq("group_id", groupId);
    
    if (error) throw error;
    
    res.json({ 
      members: members.map(m => ({ ...m.user, joinedAt: m.joined_at })),
      isFull: members.length >= MAX_GROUP_SIZE
    });
  } catch (err) {
    console.error("[Groups] Members error:", err);
    res.status(500).json({ error: "Failed to fetch members" });
  }
});

// Invite user to group
router.post("/:groupId/invite", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { groupId } = req.params;
    const { invitedUserId } = req.body;
    
    // Check if group has space
    const { count } = await supabase
      .from("group_members")
      .select("*", { count: "exact", head: true })
      .eq("group_id", groupId);
    
    if (count >= MAX_GROUP_SIZE) {
      return res.status(400).json({ error: "Group is full (max 15 members)" });
    }
    
    // Check inviter is member
    const { data: inviter } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("group_id", groupId)
      .eq("user_id", userId)
      .maybeSingle();
    
    if (!inviter) return res.status(403).json({ error: "Not a member" });
    
    // Check not already member
    const { data: existingMember } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("group_id", groupId)
      .eq("user_id", invitedUserId)
      .maybeSingle();
    
    if (existingMember) return res.status(409).json({ error: "Already a member" });
    
    // Create invite
    const { data: invite, error } = await supabase
      .from("group_invites")
      .insert({
        group_id: groupId,
        invited_by: userId,
        invited_user_id: invitedUserId,
      })
      .select()
      .single();
    
    if (error) throw error;
    
    res.json({ invite, message: "Invitation sent" });
  } catch (err) {
    console.error("[Groups] Invite error:", err);
    res.status(500).json({ error: "Failed to invite" });
  }
});

// Accept/decline invite
router.post("/invites/:inviteId/respond", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { inviteId } = req.params;
    const { accept } = req.body;
    
    const { data: invite } = await supabase
      .from("group_invites")
      .select("*")
      .eq("id", inviteId)
      .eq("invited_user_id", userId)
      .eq("status", "pending")
      .single();
    
    if (!invite) return res.status(404).json({ error: "Invite not found" });
    
    if (!accept) {
      await supabase.from("group_invites").update({ status: "declined" }).eq("id", inviteId);
      return res.json({ message: "Invite declined" });
    }
    
    // Accept - add to group
    await supabase.from("group_members").insert({
      group_id: invite.group_id,
      user_id: userId,
    });
    
    await supabase.from("group_invites").update({ status: "accepted" }).eq("id", inviteId);
    
    res.json({ message: "Joined group" });
  } catch (err) {
    console.error("[Groups] Respond error:", err);
    res.status(500).json({ error: "Failed to respond" });
  }
});

// Leave group
router.post("/:groupId/leave", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { groupId } = req.params;
    
    const { data: group } = await supabase
      .from("groups")
      .select("created_by")
      .eq("id", groupId)
      .single();
    
    if (group?.created_by === userId) {
      return res.status(400).json({ error: "Creator cannot leave, delete group instead" });
    }
    
    await supabase
      .from("group_members")
      .delete()
      .eq("group_id", groupId)
      .eq("user_id", userId);
    
    res.json({ message: "Left group" });
  } catch (err) {
    console.error("[Groups] Leave error:", err);
    res.status(500).json({ error: "Failed to leave" });
  }
});

module.exports = router;
