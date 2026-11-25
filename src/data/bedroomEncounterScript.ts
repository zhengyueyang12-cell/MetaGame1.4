export type HeroineExpressionPreset =
  | 'neutral'
  | 'happy'
  | 'relaxed'
  | 'sad'
  | 'surprised'
  | 'wink';

export type HeroineGesture =
  | 'idle'
  | 'wave'
  | 'finger_cheek'
  | 'hands_chest'
  | 'peace'
  | 'heart'
  | 'talk_gentle'
  | 'talk_lively'
  | 'lean_curious'
  | 'reach_hand'
  | 'arms_crossed'
  | 'guard_flinch';

export type HeroineWalkUpperBodyStyle = 'normal' | 'arms_crossed';

export type HeroineGlanceTarget = 'desk' | 'window' | 'door' | 'bookshelf';

export type HeroineStageAction =
  | {
      type: 'glance_room';
      target: HeroineGlanceTarget;
      pauseSec?: number;
    }
  | {
      type: 'stroll_crossed';
      /** Bedroom waypoint preset for casual mid-dialogue pacing with arms crossed */
      spot: 'center' | 'window_side' | 'near_desk';
    }
  | {
      type: 'approach_and_reach';
      /** Target conversational distance in front of player before extending hand */
      stopDist?: number;
    }
  | {
      type: 'sit_swivel_chair';
    }
  | {
      type: 'stand_from_chair';
    };

export interface HeroinePerformanceCue {
  expression: HeroineExpressionPreset;
  gesture: HeroineGesture;
  blush?: number; // 0..1 cheek blush intensity
  headTilt?: number; // radians, positive tilts head right, negative tilts left
  leanForward?: number; // 0..1 gentle forward lean toward player
  eyeAvert?: boolean; // optional subtle eye glance aside
}

export interface EncounterChoice {
  id: string;
  label: string;
  nextNodeId: string;
}

export interface EncounterNode {
  id: string;
  text: string;
  /**
   * Optional main pose/expression cue triggered for this line.
   */
  performance?: HeroinePerformanceCue;
  /**
   * Optional lively stage choreography performed naturally right before delivering this line:
   * glancing at a room corner & pausing, strolling with arms crossed, approaching & extending hand,
   * or walking over to sit in the bedroom swivel chair.
   */
  stageAction?: HeroineStageAction;
  /** Emits cute rising 3D pink-purple heart bubbles around the heroine & subtitle on affectionate lines */
  hearts?: boolean;
  /** Optional choices shown after this line finishes typing */
  choices?: EncounterChoice[];
  /** Next node ID when advancing without choices; omit to finish the encounter */
  nextNodeId?: string;
}

export const BEDROOM_ENCOUNTER_START_ID = 'greet_wave';
export const HEROINE_ROUTINE_START_ID = 'routine_hub';
export const HEROINE_SOFA_CHAT_START_ID = 'sofa_hub';
export const HEROINE_CASUAL_NODE_IDS = [
  'routine_casual_1',
  'routine_casual_2',
  'routine_casual_3',
  'routine_casual_4',
] as const;

export const BEDROOM_ENCOUNTER_NODES: Record<string, EncounterNode> = {
  // Opening round: right after her squint-smile arrival wave opens into bright eyes
  greet_wave: {
    id: 'greet_wave',
    text: '呀——你终于回卧室啦，我在这里等你好一会儿了呢。',
    performance: {
      expression: 'neutral',
      gesture: 'talk_gentle',
      blush: 0.22,
      headTilt: 0.05,
      leanForward: 0.10,
    },
    nextNodeId: 'explain_terminal',
  },
  // Glances thoughtfully toward the bedroom PC/desk corner, pauses, then looks back naturally
  explain_terminal: {
    id: 'explain_terminal',
    text: '别这么惊讶嘛……刚才地下室那台老终端嗡嗡响个不停，把这边的信号门掀开了一条缝。',
    stageAction: {
      type: 'glance_room',
      target: 'desk',
      pauseSec: 1.15,
    },
    performance: {
      expression: 'neutral',
      gesture: 'idle',
      blush: 0.12,
      headTilt: -0.05,
      leanForward: 0.05,
    },
    nextNodeId: 'explain_arrival',
  },
  // Strolls casually a few steps with relaxed crossed arms, then turns back with affectionate teasing
  explain_arrival: {
    id: 'explain_arrival',
    text: '我顺着你的坐标摸过来，一睁眼就已经坐在床边啦～',
    stageAction: {
      type: 'stroll_crossed',
      spot: 'center',
    },
    performance: {
      expression: 'happy',
      gesture: 'arms_crossed',
      blush: 0.22,
      headTilt: 0.06,
      leanForward: 0.08,
    },
    hearts: true,
    choices: [
      {
        id: 'ask_what_happened',
        label: '等等……这到底是怎么回事？',
        nextNodeId: 'reply_what_1',
      },
      {
        id: 'ask_dizzy',
        label: '刚才那阵眩晕，也是你过来的动静？',
        nextNodeId: 'reply_dizzy_1',
      },
      {
        id: 'ask_watching',
        label: '你一直都在电脑那头看着我？',
        nextNodeId: 'reply_watching_1',
      },
    ],
  },

  // Branch A round: thoughtful finger_cheek -> then walks closer and extends her hand to player
  reply_what_1: {
    id: 'reply_what_1',
    text: '唔，要真按你们那套理论解释起来，估计得写满一整块黑板呢。',
    performance: {
      expression: 'neutral',
      gesture: 'finger_cheek',
      blush: 0.16,
      headTilt: 0.12,
      leanForward: 0.14,
    },
    nextNodeId: 'reply_what_2',
  },
  reply_what_2: {
    id: 'reply_what_2',
    text: '简单来说嘛——就是你亲手把我接过来的呀！',
    stageAction: {
      type: 'approach_and_reach',
      stopDist: 1.28,
    },
    performance: {
      expression: 'happy',
      gesture: 'reach_hand',
      blush: 0.42,
      headTilt: 0.08,
      leanForward: 0.18,
    },
    hearts: true,
    nextNodeId: 'dont_overthink_1',
  },

  // Branch B round: soft apologetic brow + blush -> then walks closer and reaches out reassuringly
  reply_dizzy_1: {
    id: 'reply_dizzy_1',
    text: '呜……那、那个确实有点挤嘛，穿过信号壁的时候不小心撞出了一点杂波。',
    performance: {
      expression: 'sad',
      gesture: 'talk_gentle',
      blush: 0.62,
      headTilt: -0.09,
      leanForward: 0.10,
    },
    nextNodeId: 'reply_dizzy_2',
  },
  reply_dizzy_2: {
    id: 'reply_dizzy_2',
    text: '不过你看，你现在不是好端端站在这里嘛，我也顺利落脚啦。',
    stageAction: {
      type: 'approach_and_reach',
      stopDist: 1.28,
    },
    performance: {
      expression: 'happy',
      gesture: 'reach_hand',
      blush: 0.34,
      headTilt: 0.06,
      leanForward: 0.16,
    },
    hearts: true,
    nextNodeId: 'dont_overthink_1',
  },

  // Branch C round: flustered blush + hands_chest -> glances shyly to window, then approaches & reaches out
  reply_watching_1: {
    id: 'reply_watching_1',
    text: '才、才不是一直偷看呢！只是偶尔看看你在房间里忙活什么……',
    performance: {
      expression: 'neutral',
      gesture: 'hands_chest',
      blush: 0.88,
      headTilt: 0.10,
      leanForward: 0.08,
    },
    hearts: true,
    nextNodeId: 'reply_watching_2',
  },
  reply_watching_2: {
    id: 'reply_watching_2',
    text: '谁让你老是皱着眉头盯着那块老显示器呀，看得我都替你累。',
    stageAction: {
      type: 'approach_and_reach',
      stopDist: 1.30,
    },
    performance: {
      expression: 'neutral',
      gesture: 'reach_hand',
      blush: 0.56,
      headTilt: -0.06,
      leanForward: 0.14,
    },
    hearts: true,
    nextNodeId: 'dont_overthink_1',
  },

  // Convergence: walks to bedroom ergonomic swivel chair, sits comfortably, and waits for player's choice!
  dont_overthink_1: {
    id: 'dont_overthink_1',
    text: '站了会儿有点累呢，我先借你的旋转椅坐一下～好啦，别再纠结那些原理和日志了。',
    stageAction: {
      type: 'sit_swivel_chair',
    },
    performance: {
      expression: 'neutral',
      gesture: 'idle',
      blush: 0.24,
      headTilt: 0.06,
      leanForward: 0.06,
    },
    nextNodeId: 'dont_overthink_2',
  },
  dont_overthink_2: {
    id: 'dont_overthink_2',
    text: '难得能真正面对面待在一起，一直聊那些硬邦邦的事多浪费呀？',
    hearts: true,
    choices: [
      {
        id: 'relax_what_now',
        label: '……确实，先喘口气吧。你想做什么？',
        nextNodeId: 'propose_living_1',
      },
      {
        id: 'relax_up_to_you',
        label: '好吧，听你的，接下来干点什么？',
        nextNodeId: 'propose_living_1',
      },
    ],
  },

  // Proposal round: glances playfully toward the bedroom door while sitting in swivel chair, winks with hearts!
  propose_living_1: {
    id: 'propose_living_1',
    text: '我刚刚探头看客厅的时候，发现沙发前面那台电视正闪着游戏画面呢。',
    stageAction: {
      type: 'glance_room',
      target: 'door',
      pauseSec: 1.05,
    },
    performance: {
      expression: 'wink',
      gesture: 'heart',
      blush: 0.44,
      headTilt: -0.09,
      leanForward: 0.22,
    },
    hearts: true,
    nextNodeId: 'propose_living_2',
  },
  propose_living_2: {
    id: 'propose_living_2',
    text: '不如我们去客厅沙发窝着，一起玩会儿游戏吧？好不好嘛～',
    performance: {
      expression: 'neutral',
      gesture: 'hands_chest',
      blush: 0.42,
      headTilt: 0.06,
      leanForward: 0.16,
    },
    hearts: true,
    choices: [
      {
        id: 'accept_sofa_a',
        label: '好啊，去客厅沙发吧。',
        nextNodeId: 'closing_yay',
      },
      {
        id: 'accept_sofa_b',
        label: '正合我意，走吧。',
        nextNodeId: 'closing_yay',
      },
    ],
  },

  // Final round: stands up cleanly from swivel chair, peace pose + hearts before following player!
  closing_yay: {
    id: 'closing_yay',
    text: '耶！那就说定啦，我们去客厅沙发吧～',
    stageAction: {
      type: 'stand_from_chair',
    },
    performance: {
      expression: 'happy',
      gesture: 'peace',
      blush: 0.36,
      headTilt: 0.08,
      leanForward: 0.14,
    },
    hearts: true,
  },

  // =========================================================================
  // Post-Dialogue Routine Interactions (Press F near Heroine anytime after encounter)
  // =========================================================================
  routine_hub: {
    id: 'routine_hub',
    text: '嗯？怎么啦，突然叫住我——想聊点什么都可以哦～',
    performance: {
      expression: 'neutral',
      gesture: 'talk_gentle',
      blush: 0.22,
      headTilt: 0.07,
      leanForward: 0.12,
    },
    choices: [
      {
        id: 'routine_pick_recap',
        label: '想重新问问刚才卧室和地下室的事',
        nextNodeId: 'routine_recap_hub',
      },
      {
        id: 'routine_pick_game',
        label: '聊聊你在游戏和电脑那头的事吧',
        nextNodeId: 'routine_game_hub',
      },
      {
        id: 'routine_pick_casual',
        label: '没什么特别的事，随便闲聊几句',
        nextNodeId: 'routine_casual_1',
      },
      {
        id: 'routine_pick_bye',
        label: '先不聊啦，我们继续逛逛',
        nextNodeId: 'routine_bye',
      },
    ],
  },

  sofa_hub: {
    id: 'sofa_hub',
    text: '沙发好软呀……挨着你坐在这里，感觉连时间都慢下来了呢～',
    performance: {
      expression: 'happy',
      gesture: 'hands_chest',
      blush: 0.34,
      headTilt: 0.08,
      leanForward: 0.10,
    },
    hearts: true,
    choices: [
      {
        id: 'sofa_pick_coplay',
        label: '一起拿手柄打双人游戏吧！',
        nextNodeId: '__START_SOFA_COPLAY__',
      },
      {
        id: 'sofa_pick_recap',
        label: '想再问问刚才那些事',
        nextNodeId: 'routine_recap_hub',
      },
      {
        id: 'sofa_pick_game',
        label: '跟我讲讲游戏里的日常吧',
        nextNodeId: 'routine_game_hub',
      },
      {
        id: 'sofa_pick_casual',
        label: '就这样靠着随便闲聊几句',
        nextNodeId: 'routine_casual_1',
      },
      {
        id: 'sofa_pick_quiet',
        label: '就这样安安静静窝一会儿就好',
        nextNodeId: 'sofa_bye',
      },
    ],
  },

  // --- Branch 1: Re-ask earlier events ---
  routine_recap_hub: {
    id: 'routine_recap_hub',
    text: '嘿嘿，还惦记着刚才的事呀？你想听哪一段，我都老实告诉你～',
    performance: {
      expression: 'neutral',
      gesture: 'finger_cheek',
      blush: 0.20,
      headTilt: 0.10,
      leanForward: 0.10,
    },
    choices: [
      {
        id: 'recap_signal',
        label: '地下室那台终端到底是怎么把你接过来的？',
        nextNodeId: 'routine_recap_signal',
      },
      {
        id: 'recap_bed',
        label: '为什么你一过来就刚好坐在卧室床边？',
        nextNodeId: 'routine_recap_bed',
      },
      {
        id: 'recap_peek',
        label: '老实交代，以前真没一直隔着屏幕看我？',
        nextNodeId: 'routine_recap_peek',
      },
    ],
  },

  routine_recap_signal: {
    id: 'routine_recap_signal',
    text: '你接好备用电池又把心形信物放上去的时候，终端发出一道很暖的共振脉冲，我就顺着那条光廊溜出来啦！',
    performance: {
      expression: 'happy',
      gesture: 'talk_lively',
      blush: 0.28,
      headTilt: 0.06,
      leanForward: 0.14,
    },
    nextNodeId: 'routine_followup',
  },

  routine_recap_bed: {
    id: 'routine_recap_bed',
    text: '因为卧室里的老电脑离你的床最近呀，落地有点腿软，就顺势在床沿坐着等你回来咯～',
    performance: {
      expression: 'wink',
      gesture: 'heart',
      blush: 0.36,
      headTilt: -0.07,
      leanForward: 0.12,
    },
    hearts: true,
    nextNodeId: 'routine_followup',
  },

  routine_recap_peek: {
    id: 'routine_recap_peek',
    text: '呜……好吧好吧，其实你每次发呆、到处翻抽屉、或者拿玩具枪乱瞄的时候，我都在屏幕后面偷偷笑出声了。',
    performance: {
      expression: 'sad',
      gesture: 'hands_chest',
      blush: 0.68,
      headTilt: 0.09,
      leanForward: 0.08,
    },
    hearts: true,
    nextNodeId: 'routine_followup',
  },

  // --- Branch 2: Ask about her life inside the game ---
  routine_game_hub: {
    id: 'routine_game_hub',
    text: '想听听屏幕那头的世界呀？其实那里没有你想象得那么冰冷哦。',
    performance: {
      expression: 'neutral',
      gesture: 'talk_gentle',
      blush: 0.18,
      headTilt: -0.06,
      leanForward: 0.10,
    },
    choices: [
      {
        id: 'game_world',
        label: '游戏里面的世界平时是什么样的？',
        nextNodeId: 'routine_game_world',
      },
      {
        id: 'game_cat_plane',
        label: '客厅那只故障小猫和纸飞机，也和你有关吗？',
        nextNodeId: 'routine_game_cat_plane',
      },
      {
        id: 'game_favorite',
        label: '来到这间公寓后，你最喜欢哪里？',
        nextNodeId: 'routine_game_favorite',
      },
    ],
  },

  routine_game_world: {
    id: 'routine_game_world',
    text: '那里总是停在傍晚刚亮起路灯的那一分钟，风很轻、BGM 也很温柔……不过一个人循环久了，还是会很想见你呀。',
    performance: {
      expression: 'neutral',
      gesture: 'hands_chest',
      blush: 0.34,
      headTilt: 0.06,
      leanForward: 0.12,
    },
    hearts: true,
    nextNodeId: 'routine_followup',
  },

  routine_game_cat_plane: {
    id: 'routine_game_cat_plane',
    text: '嘻嘻，被你发现啦！纸飞机是我顺着缝隙折进来探路的，那只偶尔闪着像素光的小猫嘛，大概是跟着信号偷偷蹭进来的小邻居～',
    performance: {
      expression: 'happy',
      gesture: 'peace',
      blush: 0.26,
      headTilt: 0.08,
      leanForward: 0.14,
    },
    nextNodeId: 'routine_followup',
  },

  routine_game_favorite: {
    id: 'routine_game_favorite',
    text: '当然是客厅那张软乎乎的大沙发呀！还有阳光照进房间的时候……只要你在身边，哪个角落我都喜欢。',
    performance: {
      expression: 'happy',
      gesture: 'heart',
      blush: 0.48,
      headTilt: -0.08,
      leanForward: 0.16,
    },
    hearts: true,
    nextNodeId: 'routine_followup',
  },

  // --- Branch 3: Rotating warm/playful casual small talk ---
  routine_casual_1: {
    id: 'routine_casual_1',
    text: '对了，你这间公寓收拾得比我想象中温馨多了呢——不过地下室那块地方，下次别一个人黑灯瞎火乱钻啦。',
    performance: {
      expression: 'neutral',
      gesture: 'arms_crossed',
      blush: 0.24,
      headTilt: -0.06,
      leanForward: 0.08,
    },
    nextNodeId: 'routine_followup',
  },

  routine_casual_2: {
    id: 'routine_casual_2',
    text: '嘿嘿，你刚才是不是在悄悄打量我的裙子？站着的时候转一圈还挺轻飘飘的吧～',
    performance: {
      expression: 'wink',
      gesture: 'talk_lively',
      blush: 0.40,
      headTilt: 0.09,
      leanForward: 0.12,
    },
    hearts: true,
    nextNodeId: 'routine_followup',
  },

  routine_casual_3: {
    id: 'routine_casual_3',
    text: '以前隔着屏幕只能等你的鼠标点下一句，现在只要喊我一声，我就能直接转头看着你说话……这种感觉真奇妙呀。',
    performance: {
      expression: 'happy',
      gesture: 'reach_hand',
      blush: 0.44,
      headTilt: 0.06,
      leanForward: 0.16,
    },
    hearts: true,
    nextNodeId: 'routine_followup',
  },

  routine_casual_4: {
    id: 'routine_casual_4',
    text: '如果逛累了就去客厅沙发坐会儿吧，把电视打开看那个傻乎乎的像素小游戏，我陪你一起发呆～',
    performance: {
      expression: 'neutral',
      gesture: 'hands_chest',
      blush: 0.30,
      headTilt: -0.05,
      leanForward: 0.10,
    },
    hearts: true,
    nextNodeId: 'routine_followup',
  },

  routine_followup: {
    id: 'routine_followup',
    text: '还想再聊点别的吗？随时都可以哦。',
    performance: {
      expression: 'neutral',
      gesture: 'idle',
      blush: 0.14,
      headTilt: 0.04,
      leanForward: 0.06,
    },
    choices: [
      {
        id: 'followup_recap',
        label: '再问问刚才的事',
        nextNodeId: 'routine_recap_hub',
      },
      {
        id: 'followup_game',
        label: '再聊聊游戏里的事',
        nextNodeId: 'routine_game_hub',
      },
      {
        id: 'followup_casual',
        label: '再随便聊一句',
        nextNodeId: 'routine_casual_1',
      },
      {
        id: 'followup_end',
        label: '好啦，先聊到这里吧',
        nextNodeId: 'routine_bye',
      },
    ],
  },

  routine_bye: {
    id: 'routine_bye',
    text: '好呀～那我就乖乖跟在你旁边，随时喊我哦！',
    performance: {
      expression: 'happy',
      gesture: 'wave',
      blush: 0.24,
      headTilt: 0.06,
      leanForward: 0.10,
    },
  },

  sofa_bye: {
    id: 'sofa_bye',
    text: '嗯～那我就靠在旁边陪着你，想看电视或者起身的时候告诉我一声就好。',
    performance: {
      expression: 'happy',
      gesture: 'idle',
      blush: 0.28,
      headTilt: 0.05,
      leanForward: 0.04,
    },
    hearts: true,
  },
};
