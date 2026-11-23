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
  | 'arms_crossed';

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

export const BEDROOM_ENCOUNTER_NODES: Record<string, EncounterNode> = {
  // Opening round: stands up from bed, approaches cleanly around furniture, waves hello
  greet_wave: {
    id: 'greet_wave',
    text: '呀——你终于回卧室啦，我在这里等你好一会儿了呢。',
    performance: {
      expression: 'neutral',
      gesture: 'wave',
      blush: 0.16,
      headTilt: 0.06,
      leanForward: 0.14,
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
      expression: 'relaxed',
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
      expression: 'relaxed',
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
      expression: 'relaxed',
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
      expression: 'relaxed',
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
};
