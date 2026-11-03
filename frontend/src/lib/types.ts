export interface TwoChatMessage {
  id: string;
  source: 'webhook' | 'api' | 'sent';
  fromNumber: string;
  toNumber: string;
  remoteNumber: string;
  senderName?: string;
  receiverName?: string;
  text: string;
  sentBy: 'customer' | 'agent' | 'api' | 'user';
  timestamp: string;
  event?: string;
  contactName?: string;
  mediaUrl?: string;
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

export interface TwoChatConversation {
  remoteNumber: string;
  contactName?: string;
  lastMessage: string;
  lastTimestamp: string;
  messageCount: number;
  unreadCount?: number;
}
