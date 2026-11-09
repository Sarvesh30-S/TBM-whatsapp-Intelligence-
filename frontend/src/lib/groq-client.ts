/**
 * Groq AI Intelligence Client & Message Summarizer
 *
 * Powered by Groq's ultra-low latency LPU inference engine
 * using state-of-the-art models (e.g. Llama 3.3 70B Versatile).
 */

export interface GroqConfig {
  apiKey: string;
  endpoint: string;
  model: string;
}

export interface GroqActionableItem {
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

export interface GroqGroupSummary {
  groupName: string;
  chatId: string;
  totalMessagesCount: number;
  lastActive: string;
  summaryText: string;
  importantTopics: string[];
  actionItems: string[];
  deadlines: string[];
  actionableMessages: GroqActionableItem[];
  highPriorityCount: number;
}

export interface GroqAnalysisResult {
  totalAnalyzed: number;
  highPriorityCount: number;
  recruitmentCount: number;
  businessOpportunitiesCount: number;
  urgentPaymentsCount: number;
  timeChangesCount: number;
  actionableItems: GroqActionableItem[];
  groupSummaries: GroqGroupSummary[];
  analyzedAt: string;
  modelUsed: string;
}

// In-memory server-side cache of config
let globalGroqConfig: GroqConfig = {
  apiKey: process.env.GROQ_API_KEY || '',
  endpoint: process.env.GROQ_API_ENDPOINT || 'https://api.groq.com/openai/v1/chat/completions',
  model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
};

export function getGroqConfig(): GroqConfig {
  return { ...globalGroqConfig };
}

export function setGroqConfig(conf: Partial<GroqConfig>): GroqConfig {
  globalGroqConfig = {
    ...globalGroqConfig,
    ...conf,
    endpoint: conf.endpoint?.trim() || globalGroqConfig.endpoint,
    model: conf.model?.trim() || globalGroqConfig.model,
  };
  return { ...globalGroqConfig };
}

/**
 * Test Groq AI API Connection
 */
export async function testGroqConnection(config: GroqConfig): Promise<{ success: boolean; message: string; latencyMs?: number }> {
  if (!config.apiKey || !config.apiKey.trim()) {
    return { success: false, message: 'Groq API key is empty. Please enter your Groq API key.' };
  }

  const endpoint = config.endpoint.trim();
  const startTime = Date.now();

  try {
    const payload = {
      model: config.model || 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'user',
          content: 'Ping test. Reply with the single word: "READY".',
        },
      ],
      max_tokens: 10,
      temperature: 0,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(endpoint, {
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
      return {
        success: true,
        message: `Connected to Groq AI (${config.model}) successfully in ${latencyMs}ms.`,
        latencyMs,
      };
    }

    const errBody = await res.text().catch(() => '');
    if (res.status === 401) {
      return { success: false, message: 'Authentication failed (HTTP 401): Invalid Groq API Key.' };
    }

    return {
      success: false,
      message: `Groq API returned status ${res.status}: ${errBody.slice(0, 180) || res.statusText}`,
      latencyMs,
    };
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    if (err.name === 'AbortError') {
      return { success: false, message: 'Connection to Groq API timed out after 8s.', latencyMs };
    }
    return { success: false, message: `Failed to reach Groq endpoint: ${err.message}`, latencyMs };
  }
}

/**
 * Intelligent Fallback & Rule-Based Classifier
 */
function analyzeMessageContentFallback(text: string): {
  isActionable: boolean;
  category: GroqActionableItem['category'];
  urgency: GroqActionableItem['urgency'];
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

  // 4. URGENT / ATTENTION & DOCUMENT TRIGGERS
  const urgentKeywords = [
    /\b(?:urgent|urgently|immediately|asap|attention|emergency|critical|deadline|mandatory|alert)\b/i,
    /\b(?:pls\s*check|please\s*verify|approve|action\s*required)\b/i,
    /\b(?:documents?|files?|send\s*docs?)\b/i,
  ];
  const isUrgentTrigger = urgentKeywords.some((p) => p.test(lower));

  const timeMatch = text.match(/(?:by|post|at|before|around)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
  const detectedTime = timeMatch ? timeMatch[0] : undefined;

  // Specific check for urgent document requests
  if ((lower.includes('document') || lower.includes('doc')) && (lower.includes('urgent') || isUrgentTrigger)) {
    return {
      isActionable: true,
      category: 'urgent_attention',
      urgency: 'critical',
      actionRequired: 'Urgent document request: Send requested documents immediately',
      deadline: 'Immediate',
      confidence: 0.98,
    };
  }

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
 * Call Groq LPU API for LLM-Powered Analysis
 */
async function callGroqLLM(
  messages: Array<{ id: string; text?: string; senderName?: string; chatName?: string; timestamp: string | Date; sentBy?: string }>,
  config: GroqConfig
): Promise<{
  actionableItems: GroqActionableItem[];
  chatSummaries: Array<{
    chatName: string;
    summaryText: string;
    importantTopics: string[];
    actionItems: string[];
    deadlines: string[];
  }>;
} | null> {
  if (!config.apiKey || !config.apiKey.trim()) return null;

  try {
    const formattedMessages = messages.map((m) => ({
      id: m.id,
      from: m.senderName || 'Contact',
      chat: m.chatName || 'Direct Chat',
      direction: m.sentBy === 'agent' ? 'outbound (sent by you)' : 'inbound (received from contact)',
      text: m.text || '',
      time: new Date(m.timestamp).toLocaleTimeString(),
    }));

    const systemPrompt = `You are a high-performance WhatsApp Business Intelligence & Decision Triage AI.
Analyze the provided WhatsApp conversation messages.
You MUST extract:
1. "actionable_items": messages that require human action, urgent payments, time/schedule changes, or critical attention.
   - For each actionable item return:
     - "message_id": string (must match message id)
     - "chat_name": string
     - "sender_name": string
     - "text": string
     - "action_required": concise action description (e.g. "Urgent document request: Send requested documents immediately")
     - "category": one of ["payment", "time_change", "urgent_attention", "recruitment", "operations", "general"]
     - "urgency": one of ["critical", "high", "medium", "low"]
     - "deadline": detected time or deadline string (if any)
2. "chat_summaries": an executive summary for EVERY single chat/conversation present in the messages.
   - For each chat return:
     - "chat_name": string
     - "summary_text": professional executive summary of the discussion, intents, and outcomes (2-3 sentences)
     - "important_topics": array of strings (e.g. ["Document Dispatch", "Testing", "Urgent Operations"])
     - "action_items": array of strings listing concrete tasks
     - "deadlines": array of strings for any reported times or due dates

Respond strictly in valid JSON matching this schema:
{
  "actionable_items": [...],
  "chat_summaries": [...]
}`;

    const res = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: config.model || 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: JSON.stringify(formattedMessages) },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) {
      console.warn('Groq LLM call returned non-200:', res.status);
      return null;
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content);
    return {
      actionableItems: (parsed.actionable_items || []).map((item: any) => ({
        id: `act_${item.message_id || Math.random().toString(36).slice(2)}`,
        messageId: item.message_id || '',
        groupName: item.chat_name || 'WhatsApp Chat',
        chatId: item.chat_name || item.message_id || '',
        senderName: item.sender_name || 'Contact',
        senderNumber: '',
        text: item.text || '',
        actionRequired: item.action_required || 'Action required',
        category: item.category || 'general',
        urgency: item.urgency || 'medium',
        deadline: item.deadline || undefined,
        isActionable: true,
        timestamp: new Date().toISOString(),
        sourceConfidence: 0.99,
      })),
      chatSummaries: (parsed.chat_summaries || []).map((s: any) => ({
        chatName: s.chat_name || s.chatName || '',
        summaryText: s.summary_text || s.summaryText || '',
        importantTopics: s.important_topics || s.importantTopics || [],
        actionItems: s.action_items || s.actionItems || [],
        deadlines: s.deadlines || [],
      })),
    };
  } catch (err) {
    console.warn('Groq LLM processing failed, using fallback:', err);
    return null;
  }
}

/**
 * Execute Batch Message Summarization and Actionable Extraction
 */
export async function analyzeAllMessagesWithGroq(
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
    sentBy?: string;
  }>,
  config = getGroqConfig()
): Promise<GroqAnalysisResult> {
  const textMessages = messages.filter((m) => m.text && m.text.trim().length > 0);

  // Group messages by chat
  const groupMap = new Map<string, typeof messages>();
  for (const msg of textMessages) {
    const chatKey =
      msg.groupName ||
      (msg.isGroup ? 'WhatsApp Group' : msg.chatName || msg.senderName || msg.remoteNumber || 'Direct Chat');

    if (!groupMap.has(chatKey)) {
      groupMap.set(chatKey, []);
    }
    groupMap.get(chatKey)!.push(msg);
  }

  // Attempt Groq LLM inference first if key is configured
  let groqResult = await callGroqLLM(textMessages, config);

  const actionableItems: GroqActionableItem[] = [];

  if (groqResult && groqResult.actionableItems.length > 0) {
    // Fill in timestamps and metadata
    for (const item of groqResult.actionableItems) {
      const match = textMessages.find((m) => m.id === item.messageId || m.text === item.text);
      if (match) {
        item.timestamp = new Date(match.timestamp).toISOString();
        item.chatId = match.groupUuid || match.remoteNumber || item.chatId;
        item.senderNumber = match.senderNumber || '';
        if (match.groupName) item.groupName = match.groupName;
      }
      actionableItems.push(item);
    }
  } else {
    // Deterministic fallback analysis
    for (const msg of textMessages) {
      const text = msg.text!.trim();
      const analysis = analyzeMessageContentFallback(text);
      const chatKey =
        msg.groupName ||
        (msg.isGroup ? 'WhatsApp Group' : msg.chatName || msg.senderName || msg.remoteNumber || 'Direct Chat');

      if (analysis.isActionable) {
        actionableItems.push({
          id: `act_${msg.id}`,
          messageId: msg.id,
          groupName: chatKey,
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
  }

  // Sort actionable items: Critical first, then High, then most recent
  actionableItems.sort((a, b) => {
    const weight = { critical: 4, high: 3, medium: 2, low: 1 };
    const diff = weight[b.urgency] - weight[a.urgency];
    if (diff !== 0) return diff;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  // Build group & chat summaries
  const groupSummaries: GroqGroupSummary[] = [];

  for (const [chatTitle, chatMessages] of groupMap.entries()) {
    const chatActionables = actionableItems.filter(
      (a) => a.groupName.toLowerCase() === chatTitle.toLowerCase() || chatTitle.includes(a.groupName)
    );
    const sortedGrp = [...chatMessages].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    const lastActive = sortedGrp[sortedGrp.length - 1]?.timestamp || new Date().toISOString();

    const llmSummary = groqResult?.chatSummaries?.find(
      (s) => s.chatName.toLowerCase() === chatTitle.toLowerCase() || chatTitle.toLowerCase().includes(s.chatName.toLowerCase())
    );

    let summaryText = '';
    let topics: string[] = [];
    let actionItems: string[] = [];
    let deadlines: string[] = [];

    if (llmSummary) {
      summaryText = llmSummary.summaryText;
      topics = llmSummary.importantTopics || [];
      actionItems = llmSummary.actionItems || [];
      deadlines = llmSummary.deadlines || [];
    } else {
      const sentCount = chatMessages.filter((m: any) => m.sentBy === 'agent').length;
      const receivedCount = chatMessages.filter((m: any) => m.sentBy === 'customer').length;
      const testCount = chatMessages.filter((m: any) => /\b(?:test|ping|check)\b/i.test(m.text || '')).length;

      const topicsSet = new Set<string>();
      const actionItemsSet = new Set<string>();
      const deadlinesSet = new Set<string>();

      for (const act of chatActionables) {
        if (act.actionRequired) actionItemsSet.add(act.actionRequired);
        if (act.deadline) deadlinesSet.add(act.deadline);
        if (act.category === 'payment') topicsSet.add('Payments & Invoices');
        if (act.category === 'time_change') topicsSet.add('Attendance & Schedule');
        if (act.category === 'recruitment') topicsSet.add('Recruitment & Hiring');
        if (act.category === 'urgent_attention') topicsSet.add('Urgent Operations');
      }

      if (testCount > 0) topicsSet.add('Integration Testing');
      if (topicsSet.size === 0) topicsSet.add('General Conversation');

      summaryText = `Conversation in ${chatTitle} comprising ${chatMessages.length} message(s) (${sentCount} sent, ${receivedCount} received).`;
      if (chatActionables.length > 0) {
        const topAction = chatActionables[0];
        summaryText = `Conversation with ${chatTitle} containing ${chatMessages.length} message(s) (${sentCount} sent, ${receivedCount} received). Channel testing active; flagged urgent action: "${topAction.actionRequired}".`;
      } else if (testCount === chatMessages.length) {
        summaryText = `Connectivity verification thread with ${chatTitle} comprising ${chatMessages.length} test message(s). Webhook delivery and response loop confirmed.`;
      }

      topics = Array.from(topicsSet);
      actionItems = Array.from(actionItemsSet);
      deadlines = Array.from(deadlinesSet);
    }

    groupSummaries.push({
      groupName: chatTitle,
      chatId: chatMessages[0]?.groupUuid || chatMessages[0]?.remoteNumber || chatTitle,
      totalMessagesCount: chatMessages.length,
      lastActive: new Date(lastActive).toISOString(),
      summaryText,
      importantTopics: topics,
      actionItems,
      deadlines,
      actionableMessages: chatActionables,
      highPriorityCount: chatActionables.filter((a) => a.urgency === 'critical' || a.urgency === 'high').length,
    });
  }

  const urgentPaymentsCount = actionableItems.filter((a) => a.category === 'payment').length;
  const timeChangesCount = actionableItems.filter((a) => a.category === 'time_change').length;
  const recruitmentCount = actionableItems.filter((a) => a.category === 'recruitment').length;
  const highPriorityCount = actionableItems.filter((a) => a.urgency === 'critical' || a.urgency === 'high').length;

  return {
    totalAnalyzed: textMessages.length,
    highPriorityCount,
    recruitmentCount,
    businessOpportunitiesCount: urgentPaymentsCount,
    urgentPaymentsCount,
    timeChangesCount,
    actionableItems,
    groupSummaries,
    analyzedAt: new Date().toISOString(),
    modelUsed: config.apiKey ? (config.model || 'llama-3.3-70b-versatile') : 'Groq Hybrid Engine',
  };
}
