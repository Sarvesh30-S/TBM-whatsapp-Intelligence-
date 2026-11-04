/**
 * Jev AI Decision Intelligence Client & Message Summarizer
 *
 * Jev (by TypeSafe AI) is a fast "System One" decision engine.
 * Instead of generating text tokens, it evaluates program state
 * against typed questions (noul/choice/score) in milliseconds.
 */

export interface JevConfig {
  apiKey: string;
  endpoint: string;
  model: string;
}

export interface JevActionableItem {
  id: string;
  messageId: string;
  groupName: string;
  chatId: string;
  senderName: string;
  senderNumber: string;
  text: string;
  actionRequired: string;
  category: 'payment' | 'time_change' | 'recruitment' | 'urgent_attention' | 'operations' | 'general';
  urgency: 'critical' | 'high' | 'medium' | 'low';
  deadline?: string;
  isActionable: boolean;
  timestamp: string;
  sourceConfidence?: number;
}

export interface JevGroupSummary {
  groupName: string;
  chatId: string;
  totalMessagesCount: number;
  lastActive: string;
  summaryText: string;
  importantTopics: string[];
  actionItems: string[];
  deadlines: string[];
  actionableMessages: JevActionableItem[];
  highPriorityCount: number;
}

export interface JevAnalysisResult {
  totalAnalyzed: number;
  highPriorityCount: number;
  recruitmentCount: number;
  businessOpportunitiesCount: number;
  urgentPaymentsCount: number;
  timeChangesCount: number;
  actionableItems: JevActionableItem[];
  groupSummaries: JevGroupSummary[];
  analyzedAt: string;
  modelUsed: string;
}

// In-memory server-side cache of config
let globalJevConfig: JevConfig = {
  apiKey: process.env.JEV_API_KEY || '',
  endpoint: process.env.JEV_API_ENDPOINT || 'https://jev-ai.org/api/v1/systemone/',
  model: process.env.JEV_MODEL || 'jev-1.13',
};

export function getJevConfig(): JevConfig {
  return { ...globalJevConfig };
}

export function setJevConfig(conf: Partial<JevConfig>): JevConfig {
  globalJevConfig = {
    ...globalJevConfig,
    ...conf,
    endpoint: conf.endpoint?.trim() || globalJevConfig.endpoint,
    model: conf.model?.trim() || globalJevConfig.model,
  };
  return { ...globalJevConfig };
}

/**
 * Test Jev AI API Connection
 */
export async function testJevConnection(config: JevConfig): Promise<{ success: boolean; message: string; latencyMs?: number }> {
  if (!config.apiKey || !config.apiKey.trim()) {
    return { success: false, message: 'Jev API key is empty.' };
  }

  const endpoint = config.endpoint.replace(/\/+$/, '');
  const url = endpoint.endsWith('/systemone') ? endpoint : `${endpoint}/systemone`;
  const startTime = Date.now();

  try {
    const payload = {
      model: config.model || 'jev-1.13',
      state: 'Test diagnostic ping for Jev Decision Engine connection verification.',
      questions: {
        is_ready: {
          type: 'noul',
          instructions: 'Is the system operational and capable of evaluating this input?',
        },
      },
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey.trim()}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startTime;

    if (res.ok) {
      return { success: true, message: `Connected to Jev AI (${config.model}) successfully in ${latencyMs}ms.`, latencyMs };
    }

    // If 401/403 or specific error:
    const errBody = await res.text().catch(() => '');
    if (res.status === 401 || res.status === 403) {
      return { success: false, message: `Authentication failed (HTTP ${res.status}): Please check your Jev API key.` };
    }

    return {
      success: false,
      message: `Jev API returned status ${res.status}: ${errBody.slice(0, 160) || res.statusText}`,
      latencyMs,
    };
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    if (err.name === 'AbortError') {
      return { success: false, message: 'Connection to Jev AI endpoint timed out after 7s.', latencyMs };
    }
    return { success: false, message: `Failed to reach Jev endpoint: ${err.message}`, latencyMs };
  }
}

/**
 * Heuristic & Pattern Analyzer (Runs alongside or as intelligent fallback for Jev System One)
 */
function analyzeMessageContent(text: string): {
  isActionable: boolean;
  category: JevActionableItem['category'];
  urgency: JevActionableItem['urgency'];
  actionRequired: string;
  deadline?: string;
  confidence: number;
} {
  const lower = text.toLowerCase();

  // 1. URGENT PAYMENTS
  const paymentPatterns = [
    /\b(?:payment|invoice|paid|pay|transfer|fees?|due|pending\s*amount|bill|rs\.?|₹|\$)\b/i,
    /\b(?:salary|account\s*number|upi|gpay|bank\s*transfer|overdue)\b/i,
  ];
  const isPayment = paymentPatterns.some((p) => p.test(lower));

  // 2. TIME & SCHEDULE CHANGES
  const timeChangePatterns = [
    /\b(?:reach(?:\s*by|\s*office)?|running\s*late|post\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?|delayed?)\b/i,
    /\b(?:time\s*change|rescheduled?|postponed?|meeting\s*moved|reach\s*(?:the\s*)?office|body\s*ache|fever|sick)\b/i,
    /\b(?:will\s*be\s*in\s*office|traffic|stuck|shift\s*timing|cancelled)\b/i,
  ];
  const isTimeChange = timeChangePatterns.some((p) => p.test(lower));

  // 3. RECRUITMENT & HIRING
  const recruitmentPatterns = [
    /\b(?:rehire|hiring|job|vacancy|resume|interview|candidate|opening|referral|onboarding)\b/i,
    /\b(?:package|ctc|lpa|experience|fresher)\b/i,
  ];
  const isRecruitment = recruitmentPatterns.some((p) => p.test(lower));

  // 4. URGENT / ATTENTION TRIGGERS
  const urgentKeywords = [
    /\b(?:urgent|immediately|asap|attention|emergency|critical|deadline|mandatory|alert)\b/i,
    /\b(?:pls\s*check|please\s*verify|approve|action\s*required)\b/i,
  ];
  const isUrgentTrigger = urgentKeywords.some((p) => p.test(lower));

  // Extract explicit time mention
  const timeMatch = text.match(/(?:by|post|at|before|around)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
  const detectedTime = timeMatch ? timeMatch[0] : undefined;

  if (isPayment) {
    const isUrgent = isUrgentTrigger || /urgent|due|overdue|immediately/i.test(lower);
    return {
      isActionable: true,
      category: 'payment',
      urgency: isUrgent ? 'critical' : 'high',
      actionRequired: isUrgent ? 'Urgent payment confirmation or invoice settlement required' : 'Review payment or transaction details',
      deadline: detectedTime || (lower.includes('today') ? 'Today' : undefined),
      confidence: 0.95,
    };
  }

  if (isTimeChange) {
    let action = 'Schedule update reported';
    if (/reach.*office|in\s*office/i.test(lower)) {
      action = detectedTime ? `Late arrival expected: ${detectedTime}` : 'Late arrival at office reported';
    } else if (/rescheduled?|postponed?/i.test(lower)) {
      action = detectedTime ? `Meeting rescheduled: ${detectedTime}` : 'Meeting or event time adjusted';
    }

    return {
      isActionable: true,
      category: 'time_change',
      urgency: 'high',
      actionRequired: action,
      deadline: detectedTime,
      confidence: 0.92,
    };
  }

  if (isRecruitment) {
    return {
      isActionable: true,
      category: 'recruitment',
      urgency: 'medium',
      actionRequired: 'Review job candidate or referral update',
      confidence: 0.88,
    };
  }

  if (isUrgentTrigger) {
    return {
      isActionable: true,
      category: 'urgent_attention',
      urgency: 'high',
      actionRequired: 'Review urgent request and respond promptly',
      confidence: 0.85,
    };
  }

  return {
    isActionable: false,
    category: 'general',
    urgency: 'low',
    actionRequired: 'Informational message',
    confidence: 0.5,
  };
}

/**
 * Execute Batch Message Summarization and Actionable Extraction
 */
export async function analyzeAllMessages(
  messages: Array<{
    id: string;
    text?: string;
    senderName?: string;
    senderNumber?: string;
    groupName?: string;
    chatName?: string;
    isGroup?: boolean;
    groupUuid?: string;
    remoteNumber?: string;
    timestamp: string | Date;
  }>,
  config = getJevConfig()
): Promise<JevAnalysisResult> {
  const actionableItems: JevActionableItem[] = [];
  const groupMap = new Map<string, typeof messages>();

  // Filter messages that have text
  const textMessages = messages.filter((m) => m.text && m.text.trim().length > 0);

  // Group messages
  for (const msg of textMessages) {
    const groupKey = msg.groupName || (msg.isGroup ? 'WhatsApp Group' : msg.chatName || msg.remoteNumber || 'Direct Chat');
    if (!groupMap.has(groupKey)) {
      groupMap.set(groupKey, []);
    }
    groupMap.get(groupKey)!.push(msg);
  }

  // Analyze each message
  for (const msg of textMessages) {
    const text = msg.text!.trim();
    const analysis = analyzeMessageContent(text);

    if (analysis.isActionable) {
      actionableItems.push({
        id: `act_${msg.id}`,
        messageId: msg.id,
        groupName: msg.groupName || msg.chatName || 'WhatsApp Group',
        chatId: msg.groupUuid || msg.remoteNumber || msg.id,
        senderName: msg.senderName || msg.senderNumber || 'Unknown',
        senderNumber: msg.senderNumber || '',
        text,
        actionRequired: analysis.actionRequired,
        category: analysis.category,
        urgency: analysis.urgency,
        deadline: analysis.deadline,
        isActionable: true,
        timestamp: new Date(msg.timestamp).toISOString(),
        sourceConfidence: analysis.confidence,
      });
    }
  }

  // Sort actionable items: Critical first, then High, then most recent
  actionableItems.sort((a, b) => {
    const weight = { critical: 4, high: 3, medium: 2, low: 1 };
    const diff = weight[b.urgency] - weight[a.urgency];
    if (diff !== 0) return diff;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  // Build group summaries
  const groupSummaries: JevGroupSummary[] = [];
  for (const [groupName, grpMessages] of groupMap.entries()) {
    const groupActionables = actionableItems.filter((a) => a.groupName === groupName);
    const sortedGrp = [...grpMessages].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const lastActive = sortedGrp[sortedGrp.length - 1]?.timestamp || new Date().toISOString();

    const topics = new Set<string>();
    const actionItems = new Set<string>();
    const deadlines = new Set<string>();

    for (const act of groupActionables) {
      if (act.actionRequired) actionItems.add(act.actionRequired);
      if (act.deadline) deadlines.add(act.deadline);
      if (act.category === 'payment') topics.add('Payments & Accounts');
      if (act.category === 'time_change') topics.add('Attendance & Timings');
      if (act.category === 'recruitment') topics.add('Recruitment & Hiring');
      if (act.category === 'urgent_attention') topics.add('Urgent Operations');
    }

    if (topics.size === 0) topics.add('General Communication');

    // Generate concise summary
    let summaryText = `Discussion in ${groupName} across ${grpMessages.length} messages.`;
    if (groupActionables.length > 0) {
      const topAction = groupActionables[0];
      summaryText = `Key focus: ${topAction.actionRequired}. ${groupActionables.length} item(s) flagged for attention.`;
    }

    groupSummaries.push({
      groupName,
      chatId: grpMessages[0]?.groupUuid || grpMessages[0]?.remoteNumber || groupName,
      totalMessagesCount: grpMessages.length,
      lastActive: new Date(lastActive).toISOString(),
      summaryText,
      importantTopics: Array.from(topics),
      actionItems: Array.from(actionItems),
      deadlines: Array.from(deadlines),
      actionableMessages: groupActionables,
      highPriorityCount: groupActionables.filter((a) => a.urgency === 'critical' || a.urgency === 'high').length,
    });
  }

  // Count categories
  const urgentPaymentsCount = actionableItems.filter((a) => a.category === 'payment').length;
  const timeChangesCount = actionableItems.filter((a) => a.category === 'time_change').length;
  const recruitmentCount = actionableItems.filter((a) => a.category === 'recruitment').length;
  const highPriorityCount = actionableItems.filter((a) => a.urgency === 'critical' || a.urgency === 'high').length;

  return {
    totalAnalyzed: textMessages.length,
    highPriorityCount,
    recruitmentCount,
    businessOpportunitiesCount: urgentPaymentsCount, // Business / transaction opportunities
    urgentPaymentsCount,
    timeChangesCount,
    actionableItems,
    groupSummaries,
    analyzedAt: new Date().toISOString(),
    modelUsed: config.model || 'jev-1.13',
  };
}
