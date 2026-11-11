export interface TwoChatMessage {
  id: string;
  source: 'webhook' | 'api' | 'sent';
  channelNumber?: string; // The connected 2Chat WhatsApp number this message belongs to
  isGroup?: boolean;
  groupUuid?: string;
  groupName?: string;
  chatName: string; // Group Name for groups, or Contact/Phone Name for direct chats
  senderName: string; // Saved name, or pushname, or "You"
  senderNumber: string; // Phone number
  receiverName?: string; // Receiver name
  receiverNumber?: string; // Receiver phone
  fromNumber: string;
  toNumber: string;
  remoteNumber: string;
  text: string;
  sentBy: 'customer' | 'agent' | 'api' | 'user';
  timestamp: string;
  event?: string;
  mediaUrl?: string;
  quotedMessage?: string;
}

export interface TwoChatConversation {
  id: string;
  isGroup: boolean;
  name: string;
  phoneOrId: string;
  groupUuid?: string;
  lastMessage: string;
  lastTimestamp: string;
  messageCount: number;
  unreadCount?: number;
  description?: string;
  size?: number;
  ownerPhone?: string;
  twoChatLink?: string;
}

export interface TwoChatGroup {
  uuid: string;
  wa_group_name?: string;
  name?: string;
  wa_group_id?: string;
  size?: number;
  wa_subject?: string;
  wa_owner_id?: string;
  _2chat_link?: string;
}

export interface TwoChatChannel {
  uuid: string;
  friendly_name?: string;
  phone_number: string;
  connection_status?: string;
  enabled?: boolean;
  channel_type?: string;
}

export interface TwoChatContact {
  uuid?: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  phone_number?: string;
}

export const HIDDEN_PRIVATE_GROUPS = new Set([
  'tcs 2025 rehire jl update',
  'aicte internship programme ( batch - 11 )',
  'family forever 🫰🏻🥰🌹',
  'sade das bgmi🫦',
  'test grp',
]);

export function isHiddenPrivateGroup(groupName?: string | null): boolean {
  if (!groupName) return false;
  return HIDDEN_PRIVATE_GROUPS.has(groupName.trim().toLowerCase());
}
