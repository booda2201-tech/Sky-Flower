import { Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BehaviorSubject, EMPTY, Observable, Subject, concat, defer, distinctUntilChanged, map, switchMap, tap, timer } from 'rxjs';
import { MotionService } from '../core/motion.service';
import {
  BUDGETS,
  OCCASION_ACKS,
  OCCASION_ACKS_AR,
  QUESTIONS,
  recommend,
  summarise,
  summariseAr,
  typingDelay,
} from './skybot.engine';
import {
  Answers,
  BudgetAnswer,
  ChatMessage,
  ChatState,
  INITIAL_CHAT_STATE,
  OccasionAnswer,
  QuestionId,
  QuickReply,
  RecommendationMessage,
  TextMessage,
  VibeAnswer,
} from './skybot.model';

type Action = { readonly type: 'start' } | { readonly type: 'reply'; readonly reply: QuickReply };

/** Message payloads before the service stamps them with an id. */
type Draft = Omit<TextMessage, 'id'> | Omit<RecommendationMessage, 'id'>;

const END_REPLIES: readonly QuickReply[] = [
  { id: 'restart', label: 'Start over', labelAr: 'ابدأ من جديد' },
  { id: 'studio', label: 'Design my own instead', labelAr: 'صمّم باقتك بنفسك' },
];

/**
 * SkyBot's brain: a scripted, deterministic conversation driven by RxJS.
 *
 *   user taps a reply -> `actions$` -> `switchMap(run)` -> a cold stream that "types", pushes
 *   messages and finally offers the next set of quick replies.
 *
 * Everything the UI renders lives in one immutable `ChatState` inside a `BehaviorSubject`.
 * `switchMap` means a restart instantly cancels whatever the bot was in the middle of saying.
 */
@Injectable({ providedIn: 'root' })
export class SkyBotService {
  private readonly motion = inject(MotionService);

  private readonly stateSubject = new BehaviorSubject<ChatState>(INITIAL_CHAT_STATE);
  private readonly actions$ = new Subject<Action>();
  private nextId = 1;

  readonly state$: Observable<ChatState> = this.stateSubject.asObservable();
  readonly open$: Observable<boolean> = this.state$.pipe(
    map((s) => s.open),
    distinctUntilChanged(),
  );

  constructor() {
    this.actions$.pipe(switchMap((action) => this.run(action)), takeUntilDestroyed()).subscribe();
  }

  get snapshot(): ChatState {
    return this.stateSubject.value;
  }

  // ---- public API ------------------------------------------------------------------------
  open(): void {
    this.patch({ open: true });
    if (!this.snapshot.started) this.actions$.next({ type: 'start' });
  }

  close(): void {
    this.patch({ open: false });
  }

  toggle(): void {
    if (this.snapshot.open) this.close();
    else this.open();
  }

  /** The user tapped a quick reply. Ignored while SkyBot is still typing. */
  choose(reply: QuickReply): void {
    if (this.snapshot.typing) return;
    this.actions$.next({ type: 'reply', reply });
  }

  restart(): void {
    this.actions$.next({ type: 'start' });
  }

  // ---- scripts ---------------------------------------------------------------------------
  private run(action: Action): Observable<unknown> {
    return action.type === 'start' ? this.begin() : this.handle(action.reply);
  }

  private begin(): Observable<unknown> {
    return concat(
      defer(() => {
        this.patch({ started: true, messages: [], answers: {}, step: 'occasion', replies: [], typing: false });
        return EMPTY;
      }),
      this.say("Hello, I'm SkyBot - Sky Flower's floral concierge.", 'أهلاً، أنا سكاي بوت، مساعدك الشخصي للورد.'),
      this.say("Three quick questions and I'll choose the two bouquets I'd send myself.", 'ثلاثة أسئلة سريعة وأختار لك أجمل باقتين.'),
      this.ask('occasion'),
    );
  }

  private handle(reply: QuickReply): Observable<unknown> {
    const { step } = this.snapshot;

    if (step === 'done') return this.handleEndAction(reply);

    // Only accept replies that belong to the current question.
    if (!QUESTIONS[step].replies.some((r) => r.id === reply.id)) return EMPTY;

    switch (step) {
      case 'occasion': {
        const occasion = reply.id as OccasionAnswer;
        return concat(
          this.userSays(reply, { occasion }),
          this.say(OCCASION_ACKS[occasion], OCCASION_ACKS_AR[occasion]),
          this.ask('budget'),
        );
      }
      case 'budget': {
        const budget = reply.id as BudgetAnswer;
        return concat(
          this.userSays(reply, { budget }),
          this.say(`Noted - ${BUDGETS[budget].label}.`, `تمام — ${BUDGETS[budget].labelAr}.`),
          this.ask('vibe'),
        );
      }
      case 'vibe': {
        const vibe = reply.id as VibeAnswer;
        return concat(
          this.userSays(reply, { vibe }),
          this.say('Perfect. Let me look through the atelier…', 'ممتاز. دعني أبحث لك في الأتيليه…'),
          this.recommendations(),
        );
      }
    }
  }

  private handleEndAction(reply: QuickReply): Observable<unknown> {
    if (reply.id === 'restart') return this.begin();
    if (reply.id === 'studio') {
      return defer(() => {
        this.close();
        // Let the panel start closing before the page glides away.
        setTimeout(() => this.motion.scrollTo('#studio'), 250);
        return EMPTY;
      });
    }
    return EMPTY;
  }

  private ask(id: QuestionId): Observable<unknown> {
    const question = QUESTIONS[id];
    return concat(
      this.say(question.prompt, question.promptAr),
      defer(() => {
        this.patch({ step: id, replies: question.replies });
        return EMPTY;
      }),
    );
  }

  private recommendations(): Observable<unknown> {
    return concat(
      defer(() => {
        this.patch({ typing: true, replies: [] });
        return timer(1250);
      }).pipe(
        tap(() => {
          const answers = this.snapshot.answers as Required<Answers>;
          this.push({ kind: 'recommendations', from: 'bot', items: recommend(answers) });
        }),
      ),
      defer(() => {
        const answers = this.snapshot.answers as Required<Answers>;
        return this.say(
          `Those are the two I'd send for ${summarise(answers)}. Add either to your bag in one tap.`,
          `هاتان الباقتان هما اختياري لك (${summariseAr(answers)}). أضف أيًّا منهما إلى السلة بنقرة واحدة.`,
        );
      }),
      defer(() => {
        this.patch({ step: 'done', replies: END_REPLIES });
        return EMPTY;
      }),
    );
  }

  // ---- building blocks -------------------------------------------------------------------
  /** SkyBot "types" for a moment, then posts the line. */
  private say(text: string, textAr?: string): Observable<unknown> {
    return defer(() => {
      this.patch({ typing: true, replies: [] });
      return timer(typingDelay(text));
    }).pipe(tap(() => this.push({ kind: 'text', from: 'bot', text, textAr })));
  }

  /** Echoes the chosen reply as a user bubble and stores the answer. */
  private userSays(reply: QuickReply, answer: Partial<Answers>): Observable<never> {
    return defer(() => {
      this.push({ kind: 'text', from: 'user', text: reply.label, textAr: reply.labelAr });
      this.patch({ answers: { ...this.snapshot.answers, ...answer }, replies: [] });
      return EMPTY;
    });
  }

  private push(draft: Draft): void {
    const message = { ...draft, id: this.nextId++ } as ChatMessage;
    this.patch({ messages: [...this.snapshot.messages, message], typing: false });
  }

  private patch(partial: Partial<ChatState>): void {
    this.stateSubject.next({ ...this.snapshot, ...partial });
  }
}
