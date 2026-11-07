import { FlowerProduct } from '../data/flower-data';

export type OccasionAnswer = 'birthday' | 'anniversary' | 'wedding' | 'romantic' | 'luxury';
export type BudgetAnswer = 'low' | 'mid' | 'high';
export type VibeAnswer = 'bold' | 'soft' | 'fresh' | 'classic';

/** The three questions, in order, plus the terminal state once recommendations are shown. */
export type QuestionId = 'occasion' | 'budget' | 'vibe';
export type SkyBotStepId = QuestionId | 'done';

export interface QuickReply {
  /** Answer value (or an action id on the `done` step). */
  readonly id: string;
  readonly label: string;
  readonly labelAr?: string;
}

export interface Question {
  readonly id: QuestionId;
  readonly prompt: string;
  readonly promptAr: string;
  readonly replies: readonly QuickReply[];
}

export interface Answers {
  readonly occasion?: OccasionAnswer;
  readonly budget?: BudgetAnswer;
  readonly vibe?: VibeAnswer;
}

export interface Recommendation {
  readonly product: FlowerProduct;
  /** 0 - 100, how well it fits the three answers. */
  readonly matchPct: number;
  readonly reasons: readonly string[];
  /** The same reasons in Arabic. */
  readonly reasonsAr: readonly string[];
  readonly withinBudget: boolean;
}

interface BaseMessage {
  readonly id: number;
}

export interface TextMessage extends BaseMessage {
  readonly kind: 'text';
  readonly from: 'bot' | 'user';
  readonly text: string;
  readonly textAr?: string;
}

export interface RecommendationMessage extends BaseMessage {
  readonly kind: 'recommendations';
  readonly from: 'bot';
  readonly items: readonly Recommendation[];
}

export type ChatMessage = TextMessage | RecommendationMessage;

export interface ChatState {
  readonly open: boolean;
  /** The conversation has been kicked off at least once. */
  readonly started: boolean;
  readonly messages: readonly ChatMessage[];
  /** SkyBot is "typing" - shows the dots and hides the quick replies. */
  readonly typing: boolean;
  readonly step: SkyBotStepId;
  readonly answers: Answers;
  readonly replies: readonly QuickReply[];
}

export const INITIAL_CHAT_STATE: ChatState = {
  open: false,
  started: false,
  messages: [],
  typing: false,
  step: 'occasion',
  answers: {},
  replies: [],
};
