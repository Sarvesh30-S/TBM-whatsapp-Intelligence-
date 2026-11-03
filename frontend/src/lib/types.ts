export interface TwoChatMessage {
  id: string;
  source: 'webhook' | 'api' | 'sent';
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
}

export interface TwoChatGroup {
  uuid: string;
  wa_group_name?: string;
  name?: string;
  wa_group_id?: string;
  size?: number;
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
