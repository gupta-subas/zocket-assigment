import { BaseMemory } from '@langchain/core/memory';
import { BaseChatMessageHistory } from '@langchain/core/chat_history';
import { BaseMessage, HumanMessage, AIMessage } from '@langchain/core/messages';
import { createLogger } from '../utils/logger';
import { prisma } from '../utils/database';

const logger = createLogger();

/**
/**
 * Custom chat message history that stores messages in the database.
 */
export class DatabaseChatMessageHistory extends BaseChatMessageHistory {
  private conversationId: string;
  private messages: BaseMessage[] = [];
  private loaded = false;

  // Required by BaseChatMessageHistory, but not used in this implementation
  get lc_namespace(): string[] {
    return ['database', 'chat_message_history'];
  }

  async addUserMessage(message: string): Promise<void> {
    await this.addMessage(new HumanMessage(message));
  }

  async addAIChatMessage(message: string): Promise<void> {
    await this.addMessage(new AIMessage(message));
  }

  constructor(conversationId: string) {
    super();
    this.conversationId = conversationId;
  }

  async getMessages(): Promise<BaseMessage[]> {
    if (!this.loaded) {
      await this.loadMessages();
    }
    return this.messages;
  }

  async addMessage(message: BaseMessage): Promise<void> {
    // Add to in-memory cache
    this.messages.push(message);

    // Save to database
    try {
      await prisma.message.create({
        data: {
          conversationId: this.conversationId,
          role: message._getType() === 'human' ? 'USER' : 'ASSISTANT',
          content: message.content as string,
        },
      });
      
      logger.debug('Message saved to database', { 
        conversationId: this.conversationId,
        messageType: message._getType()
      });
    } catch (error) {
      logger.error('Failed to save message to database:', error);
      throw error;
    }
  }

  async clear(): Promise<void> {
    this.messages = [];
    
    try {
      await prisma.message.deleteMany({
        where: { conversationId: this.conversationId },
      });
      
      logger.info('Conversation messages cleared', { conversationId: this.conversationId });
    } catch (error) {
      logger.error('Failed to clear messages from database:', error);
      throw error;
    }
  }

  private async loadMessages(): Promise<void> {
    try {
      const dbMessages = await prisma.message.findMany({
        where: { conversationId: this.conversationId },
        orderBy: { createdAt: 'asc' },
      });

      this.messages = dbMessages.map(msg => {
        if (msg.role === 'USER') {
          return new HumanMessage(msg.content);
        } else {
          return new AIMessage(msg.content);
        }
      });

      this.loaded = true;
      
      logger.debug('Messages loaded from database', { 
        conversationId: this.conversationId,
        messageCount: this.messages.length
      });
    } catch (error) {
      logger.error('Failed to load messages from database:', error);
      throw error;
    }
  }
}

/**
 * Custom memory implementation for conversation management
 */
export class ConversationMemory extends BaseMemory {
  private chatHistory: DatabaseChatMessageHistory;
  private maxTokenLimit: number;
  private returnMessages: boolean;

  constructor(
    conversationId: string, 
    maxTokenLimit: number = 4000,
    returnMessages: boolean = true
  ) {
    super();
    this.chatHistory = new DatabaseChatMessageHistory(conversationId);
    this.maxTokenLimit = maxTokenLimit;
    this.returnMessages = returnMessages;
  }

  get memoryKeys(): string[] {
    return this.returnMessages ? ['history', 'messages'] : ['history'];
  }

  async loadMemoryVariables(): Promise<Record<string, any>> {
    const messages = await this.chatHistory.getMessages();
    
    if (this.returnMessages) {
      return {
        history: this.getBufferString(messages),
        messages: messages,
      };
    }
    
    return {
      history: this.getBufferString(messages),
    };
  }

  async saveContext(inputValues: Record<string, any>, outputValues: Record<string, any>): Promise<void> {
    const inputMessage = new HumanMessage(inputValues.input || inputValues.question || '');
    const outputMessage = new AIMessage(outputValues.output || outputValues.response || '');

    await this.chatHistory.addMessage(inputMessage);
    await this.chatHistory.addMessage(outputMessage);

    // Trim messages if they exceed token limit
    await this.trimMessages();
  }

  async clear(): Promise<void> {
    await this.chatHistory.clear();
  }

  /**
   * Get conversation summary for context
   */
  async getSummary(lastN: number = 10): Promise<string> {
    const messages = await this.chatHistory.getMessages();
    const recentMessages = messages.slice(-lastN);
    
    if (recentMessages.length === 0) {
      return 'This is the beginning of the conversation.';
    }

    return this.getBufferString(recentMessages);
  }

  /**
   * Get message count
   */
  async getMessageCount(): Promise<number> {
    const messages = await this.chatHistory.getMessages();
    return messages.length;
  }

  /**
   * Get messages in format suitable for Gemini API
   */
  async getGeminiHistory(): Promise<any[]> {
    const messages = await this.chatHistory.getMessages();
    
    return messages.map(msg => ({
      role: msg._getType() === 'human' ? 'USER' : 'ASSISTANT',
      content: msg.content as string,
    }));
  }

  private getBufferString(messages: BaseMessage[]): string {
    return messages
      .map(msg => {
        const role = msg._getType() === 'human' ? 'Human' : 'AI';
        return `${role}: ${msg.content}`;
      })
      .join('\n');
  }

  private async trimMessages(): Promise<void> {
    const messages = await this.chatHistory.getMessages();
    
    // Simple token estimation (rough approximation)
    let totalTokens = 0;
    const tokensPerMessage = 4; // Rough overhead per message
    
    for (const message of messages) {
      totalTokens += Math.ceil((message.content as string).length / 4) + tokensPerMessage;
    }

    // If we exceed the limit, remove oldest messages (but keep at least the last 4)
    if (totalTokens > this.maxTokenLimit && messages.length > 4) {
      const messagesToRemove = Math.floor(messages.length / 4); // Remove 25% of messages
      const messagesToKeep = messages.slice(-messagesToRemove);
      
      logger.info('Trimming conversation memory', {
        totalMessages: messages.length,
        estimatedTokens: totalTokens,
        messagesToRemove,
        messagesKept: messagesToKeep.length,
      });

      // Actually remove old messages from database
      const oldestMessages = messages.slice(0, messagesToRemove);
      const messageIdsToDelete = oldestMessages.map(msg => msg.id);

      try {
        // Get conversation ID and delete old messages
        const conversationId = this.chatHistory['conversationId'];
        await prisma.message.deleteMany({
          where: {
            conversationId,
            createdAt: {
              lt: oldestMessages[oldestMessages.length - 1].createdAt || new Date(0)
            }
          },
          take: messagesToRemove
        });

        // Update in-memory cache
        this.chatHistory['messages'] = messagesToKeep;
        
      } catch (error) {
        logger.error('Failed to trim messages from database:', error);
      }
    }
  }
}

/**
 * Memory manager for handling multiple conversations
 */
export class MemoryManager {
  private static instance: MemoryManager;
  private conversations: Map<string, ConversationMemory> = new Map();

  static getInstance(): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager();
    }
    return MemoryManager.instance;
  }

  getConversationMemory(conversationId: string): ConversationMemory {
    if (!this.conversations.has(conversationId)) {
      const memory = new ConversationMemory(conversationId);
      this.conversations.set(conversationId, memory);
      
      logger.debug('Created new conversation memory', { conversationId });
    }

    return this.conversations.get(conversationId)!;
  }

  async clearConversation(conversationId: string): Promise<void> {
    const memory = this.conversations.get(conversationId);
    if (memory) {
      await memory.clear();
      this.conversations.delete(conversationId);
      
      logger.info('Conversation memory cleared', { conversationId });
    }
  }

  /**
   * Clean up old conversations from memory (not from database)
   */
  cleanup(): void {
    // In a production system, you might want to implement LRU cache
    // or time-based cleanup of conversations
    if (this.conversations.size > 100) {
      // Keep only the most recent 50 conversations
      const entries = Array.from(this.conversations.entries());
      const toKeep = entries.slice(-50);
      
      this.conversations.clear();
      toKeep.forEach(([id, memory]) => {
        this.conversations.set(id, memory);
      });
      
      logger.info('Memory cleanup performed', { 
        kept: toKeep.length,
        removed: entries.length - toKeep.length 
      });
    }
  }
}

export const memoryManager = MemoryManager.getInstance();