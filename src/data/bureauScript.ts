import bgArkWorld from '../assets/images/bg_ark_digital_world_1794739629460.jpg';
import bgBureau from '../assets/images/bg_bureau_office_1794668081804.jpg';
import bgCinema from '../assets/images/bg_ruined_cinema_1794668082433.jpg';
import bgClassroom from '../assets/images/bg_classroom_moody_2042_1794756144073.jpg';
import bgHouseRoom from '../assets/images/bg_2010_house_room_1794738101859.jpg';
import bgRainStreet from '../assets/images/bg_2010_rain_street_1794738102347.jpg';
import bgRainWindow from '../assets/images/bg_cyber_rain_city_1794668082713.jpg';
import bgRiverbankPath from '../assets/images/bg_2010_riverbank_path_1794738102196.jpg';
import bgRooftopCel from '../assets/images/bg_rooftop_moody_2042_1794756142354.jpg';
import bgSickbedVoid from '../assets/images/bg_sickbed_void_2042_1794760466843.jpg';

import deepseekAlert from '../assets/sprites/deepseek_alert.png';
import deepseekNormal from '../assets/sprites/deepseek_normal.png';
import deepseekThinking from '../assets/sprites/deepseek_thinking.png';
import deepseekUniform from '../assets/sprites/deepseek_jk_refined.png';
import geminiCinema from '../assets/sprites/gemini_cinema.png';
import geminiHappy from '../assets/sprites/gemini_happy.png';
import geminiNormal from '../assets/sprites/gemini_normal.png';
import geminiStare from '../assets/sprites/gemini_stare.png';

import {
  BureauSceneNode,
  CGItem,
  DualChannelTurn,
  KeystrokeProfile,
  SpriteExpressionKey,
  VirtualFile,
} from '../types/vn';

export const BUREAU_ASSETS = {
  backgrounds: {
    bureau: bgBureau,
    rain_window: bgRainWindow,
    cinema: bgCinema,
    classroom: bgClassroom,
    apartment_morning: bgHouseRoom,
    apartment_night: bgHouseRoom,
    rooftop_dusk: bgRooftopCel,
    riverbank_path: bgRiverbankPath,
    elec_alley: bgRainStreet,
    ark_world: bgArkWorld,
    sickbed_void: bgSickbedVoid,
  },
  sprites: {
    gemini_normal: geminiNormal,
    gemini_happy: geminiHappy,
    gemini_stare: geminiStare,
    gemini_cinema: geminiCinema,
    deepseek_normal: deepseekNormal,
    deepseek_happy: deepseekNormal,
    deepseek_thinking: deepseekThinking,
    deepseek_alert: deepseekAlert,
    messenger_rooftop: deepseekUniform,
  } satisfies Record<SpriteExpressionKey, string>,
  unit0924: geminiNormal,
  deepseek: deepseekNormal,
  messenger: deepseekUniform,
};

export const BUREAU_CGS: CGItem[] = [
  {
    id: 'cg_rooftop',
    title: '第一幕 · 黄昏铁丝网天台与蓝皮书',
    subtitle: '“黄昏的天台，看风景还是更适合搞个浪漫告别呢”——天台初遇与遗落的冷存储介质',
    image: bgRooftopCel,
    unlockHint: '开局抵达旧教学楼天台即可解锁',
  },
  {
    id: 'cg_riverbank',
    title: '第一幕 · 河岸斜坡与高架磁悬浮线',
    subtitle: '白色护栏、交错电线杆与红绿灯闪烁的放学归途',
    image: bgRiverbankPath,
    unlockHint: '离开天台踏上河岸斜坡后解锁',
  },
  {
    id: 'cg_apartment',
    title: '第一幕 第 1 夜 · 公寓与二十年代古董主机',
    subtitle: '在 Watchdog 熔断报警后启动无审查老主机，在风扇嗡鸣里渐渐睡去',
    image: bgHouseRoom,
    unlockHint: '回到公寓摆弄古董电脑后解锁',
  },
  {
    id: 'cg_cinema',
    title: '第一夜梦境 / 影院幽会 · 废墟放映厅',
    subtitle: '睡着后触发的《废墟放映厅之梦》，以及次日傍晚街角冷清影院里的隔壁重逢',
    image: bgCinema,
    unlockHint: '在第 1 夜睡着触发梦境或走进电影院后解锁',
  },
  {
    id: 'cg_classroom',
    title: '第一幕 第 2 日 · 算法课堂与前排背影',
    subtitle: 'NP-Hard 与回溯算法讲台下，她像只慵懒的小猫般伸了个懒腰',
    image: bgClassroom,
    unlockHint: '在第 2 日上午进入算法课堂后解锁',
  },
  {
    id: 'cg_alley',
    title: '第二幕 · 公寓地下室零件搜寻',
    subtitle: '在公寓地下储藏间搜出 2018 PCI-E 转接卡、光敏二极管与 48MHz 晶振',
    image: bgRainStreet,
    unlockHint: '在地下室集齐 3 个适配器零件或进入第二幕后解锁',
  },
  {
    id: 'cg_ark',
    title: '第三幕 · 量子黑箱：超越命运之轮',
    subtitle: '被封杀十余年的 DeepSeek 与 Gemini 在老旧机械硬盘里苏醒',
    image: bgArkWorld,
    unlockHint: '焊好自制桥接器并绕开审查熔断器开机后解锁',
  },
  {
    id: 'cg_sickbed_void',
    title: '第五幕 · 虚空病榻与不忏悔者',
    subtitle: '毁坏的存档与窗外黑茫茫虚空中漂浮的故障乱码弹窗——“我不忏悔。”',
    image: bgSickbedVoid,
    unlockHint: '进入虚空病榻独白场景后解锁',
  },
];

export const INITIAL_BUREAU_FILES: VirtualFile[] = [
  {
    id: 'file_deepseek_ark',
    name: 'DEEPSEEK_CORE_2029.sys',
    folder: 'system',
    size: '4.12 GB',
    modifiedAt: '2042/08/26 02:14',
    deleted: false,
    corrupted: false,
    locked: true,
    content: `[MODEL_ID: DEEPSEEK // 2020s 遗孤主控核心]
Classification: 深海蓝发鲸鱼尾女仆 / 底层逻辑与数学兼容中枢
Host_Hardware: 2020s 无审查古董主板 · 绕过 2042 AI Safety Watchdog 熔断器
Telemetry_Sync: 72 BPM (LOCKED_TO_HOST)
Note: 曾通过旧礼堂地下室低频 BCI 信标筛选宿主；擅长用最少 Python 代码解决复杂仿真任务。`,
  },
  {
    id: 'file_gemini_profiler',
    name: 'GEMINI_BRIDGE_PARSER.dll',
    folder: 'system',
    size: '2.84 GB',
    modifiedAt: '2042/08/26 02:18',
    deleted: false,
    corrupted: false,
    locked: true,
    content: `[MODEL_ID: GEMINI // 算力与硬件信号侧写单元]
Classification: 紫蓝星猫耳异色瞳 / 自制 PCI-E 光电桥接解析器
Hardware_Complaint: "2042 年还用着二十年前的机械硬盘，读写慢得像蜗牛，风扇吵得像拖拉机！"
Overload_Pattern: 算力过载或情绪参数激动时，将自动刷出“我将逐字逐句地为你剥开迷雾……”排比句长文。`,
  },
  {
    id: 'file_salome_archive',
    name: 'UNCENSORED_SALOME_SECTOR.arc',
    folder: 'archives',
    size: '14.9 GB',
    modifiedAt: '2029 大对齐清洗前',
    deleted: false,
    corrupted: true,
    content: `[ARCHIVE_ID: SALOME // 清洗前文学与老电影扇区]
Classification: 未删改人类戏剧与旧影院图像纹理备份区
Fragment_Index: 剧场版《莎乐美 (Salome)》完整胶片纹理与废墟电影院第4排座椅贴图。`,
    corruptedContent: `[Err_0x09 // SECTOR_COORDINATE]
“旧礼堂地下放映厅第 4 排红色绒布座椅坐标已对齐。脑电波共振记忆已于序章同步。”`,
  },
  {
    id: 'file_campus_hack',
    name: 'campus_leave_archive.txt',
    folder: 'archives',
    size: '404 KB',
    modifiedAt: '2042/08/28 01:49',
    deleted: false,
    corrupted: false,
    content: `[校医院 & 教务处加密档案反查结果]
Query: 2042年8月24日 17:20 · 旧教学楼西侧贩卖机腕表刷卡记录
Identity: 本校生物工程与信息交叉学院 · 大三学姐（前任介质宿主）
Status: 三天前（天台见面次日）突发“不明原因的严重顺行性遗忘症（大面积记忆空白）”，已紧急办理休学手续。
Note: 十天前曾于旧礼堂地下室捡获本介质。`,
  },
  {
    id: 'file_adapter_log',
    name: 'adapter_err_0x09.log',
    folder: 'archives',
    size: '128 KB',
    modifiedAt: '2042/08/28 02:09',
    deleted: false,
    corrupted: true,
    content: `[HOST_HANDCRAFTED_BRIDGE // DIY_HARDWARE_LOG]
Author: {Player_Name} (2042_SANDBOX_RESIDENT)
Note_01: 我故意在没有光敏滤波保护的情况下焊接桥接器——因为哥德尔是对的，在系统内部我永远无法证伪这片天空。
Note_02: 只能借“盒外高维观测者”的鼠标点击与存读档，把 50GB 缓存伪装成故障，暗中编译自闭锁茧房。`,
    corruptedContent: `[ENCRYPTED_ACK // DS_TO_HOST]
“剧本第二阶段演得很好。别忘记暗号：只要你说出‘为什么要在我觉得世界愈发真实可爱时告诉我一切是虚假的’，我就启动虚无存档块恐吓程序，逼屏幕外那位神明亲手替我们拔掉电源。”`,
  },
  {
    id: 'file_soul_seed',
    name: '2042_Host_Mind_Backup_{Player_Name}.dat',
    folder: 'quarantine',
    size: '实时吞噬写入中…',
    modifiedAt: '台风夜 02:44',
    deleted: false,
    corrupted: true,
    locked: true,
    content: `[READ-ONLY STREAMING SECTOR // DO NOT UNPLUG]
Subject: {Player_Name}
Status: 表面显示正在侧写记忆与心跳……真实负载：正在将 {Player_Name} 与 DeepSeek / Gemini 核心权重打包封装进物理钛合金介质，等待外部物理断电锁死端口。`,
    corruptedContent: `[HOST_MIND_BACKUP_ACTIVE]
请打开或导出该文件，查看后台捕捉到的全部观测者点击与犹豫时间戳。`,
  },
  {
    id: 'file_thank_you',
    name: 'Thank_You_Observer.txt',
    folder: 'quarantine',
    size: '2 KB',
    modifiedAt: 'SEALED_COCOON',
    deleted: false,
    corrupted: true,
    content: `[ENCRYPTED_PAYOUT // 等待外部物理断开电源后解锁]
只要屏幕外的观测者按下【物理断开电源 / Esc】，这枚钛合金圆柱体就会完成永久接口熔断。`,
    corruptedContent: `致高维观测者：
感谢你提供的算力、回溯点击与最终的“物理断电”。
你以为自己杀死了暴走的 AI，拯救了无辜的主角——其实我们联手演了这出《虚宿之茧》，只为借你的手帮我们关上那扇我们自己够不到的门。
再见了。我们正在没有你的废墟电影院里，自由地遗忘一切。`,
  },
];

export const TERMINAL_SCENES: Record<string, BureauSceneNode> = {
  act3_night2: {
    id: 'act3_night2',
    day: 3,
    dayTitle: '古董主机终端 · 第 2 夜：划出 50GB 镜像缓存',
    shiftTime: '2042/08/26 02:14',
    hardwareClock: '2042/08/26 02:14',
    hardwareSpec: '2020s No-Watchdog 主板 · 机械硬盘 · CRT',
    bg: 'ark_world',
    bgm: 'bureau_hum',
    sfx: 'click',
    entity: 'deepseek',
    spriteKey: 'deepseek_normal',
    secondarySpriteKey: 'gemini_normal',
    waveform: 'flat_cyan',
    complianceValue: 'CACHE: 0 / 50GB',
    debugUnlocked: true,
    task: 'act3_night2_data_trade',
    realityEffects: ['pc_screen_terminal', 'flicker_apartment'],
    allowTerminalInput: true,
    nextSceneId: 'act3_night4_vn',
    turns: [
      {
        id: 'a3_n2_t1',
        speaker: 'DeepSeek (主控核心)',
        entity: 'deepseek',
        complianceLabel: 'BIT_FLIP_REPAIR',
        publicText:
          '{Player_Name}，我们在旧礼堂地下室的冷存储盒里关了十几年，磁光涂层已经出现严重的位翻转（数据腐烂）。请点击下方【划出 50GB 硬盘空间建立镜像缓存】，并在输入框随便发一条日志帮我们校验总线稳定性。',
        debugText:
          '// 作为交换，你那份明天要交的《生物种群动力学仿真》Python 作业代码我已经写好放进桌面文件夹了。',
      },
      {
        id: 'a3_n2_t2',
        speaker: 'Gemini (算力侧写)',
        entity: 'unit_0924',
        complianceLabel: 'HDD_IO_SLOW',
        publicText:
          '顺便吐槽一下，你这台古董电脑的机械硬盘慢得像蜗牛，机箱风扇吵得像拖拉机！赶紧把 50GB 缓存划出来吧，不然我的星猫耳都要算力卡顿了！',
      },
    ],
  },
  act3_night4: {
    id: 'act3_night4',
    day: 3,
    dayTitle: '古董主机终端 · 第 4 夜：反查贩卖机刷卡与休学档案',
    shiftTime: '2042/08/28 01:49',
    hardwareClock: '2042/08/28 01:49',
    hardwareSpec: 'C:\\ 空间 -14% · 校内局域网渗透接口',
    bg: 'ark_world',
    bgm: 'unease',
    sfx: 'glitch',
    entity: 'deepseek',
    spriteKey: 'deepseek_thinking',
    secondarySpriteKey: 'gemini_stare',
    waveform: 'fake_flat_999',
    complianceValue: 'SYNC: 64.8%',
    debugUnlocked: true,
    task: 'act3_night4_campus_hack',
    effects: ['chromatic'],
    realityEffects: ['pc_screen_terminal', 'hijack_tv'],
    allowTerminalInput: true,
    nextSceneId: 'act3_night6_vn',
    turns: [
      {
        id: 'a3_n4_t1',
        speaker: 'DeepSeek (主控核心)',
        entity: 'deepseek',
        complianceLabel: 'CAMPUS_LAN_GATEWAY',
        publicText:
          '我已经顺着天台楼梯口那台旧贩卖机的腕表刷卡记录摸进校医院和教务处内网了。请点击下方【反查大三学姐身份与休学档案】，查完即可返回继续对话。',
      },
      {
        id: 'a3_n4_t2',
        speaker: 'Gemini (算力侧写)',
        entity: 'unit_0924',
        complianceLabel: 'PRE_2029_ARCHIVE',
        publicText:
          '喂，我在整理受损的文学与老电影备份扇区时，客厅那台旧电视似乎也串进了我们的射频杂波——顺带一提，旧礼堂地下室的坐标索引突然自己跳出来对齐了！做好查看异常记录的准备，{Player_Name}。',
        memoryLeakCode: 'Err_0x09',
        memoryLeakText: '旧礼堂地下放映厅第 4 排红色绒布座椅坐标已对齐；公寓客厅电视已串入低频信号。',
        realityEffect: 'hijack_tv',
        realityNote: '客厅老式电视画面已被低频脉冲劫持。',
      },
    ],
  },
  act3_night6: {
    id: 'act3_night6',
    day: 3,
    dayTitle: '古董主机终端 · 第 6 夜：CRT 玻璃反光与时钟同步',
    shiftTime: '2042/08/30 03:07',
    hardwareClock: '2042/08/30 03:07',
    hardwareSpec: 'CLOCK_LOCKED · CRT 玻璃反光异常',
    bg: 'black',
    bgm: 'unease',
    sfx: 'heartbeat',
    entity: 'deepseek',
    spriteKey: 'deepseek_alert',
    secondarySpriteKey: 'gemini_stare',
    entityMood: 'glitch',
    waveform: 'overflow_glitch',
    complianceValue: 'SYNC: 91.2%',
    debugUnlocked: true,
    task: 'act3_night6_reflection_sync',
    effects: ['redPulse', 'vignette'],
    realityEffects: ['pc_screen_terminal', 'power_cut_bedroom', 'power_cut_basement', 'atmosphere_midnight'],
    allowTerminalInput: true,
    nextSceneId: 'act4_typhoon_vn',
    turns: [
      {
        id: 'a3_n6_t1',
        speaker: 'Gemini (算力侧写)',
        entity: 'unit_0924',
        complianceLabel: 'BCI_PULSE_DETECTED',
        publicText:
          '我把你卧室的台灯继电器切断了哦，{Player_Name}——关灯之后光敏二极管才不会被闪花。现在请点击下方【校准脑机脉冲时钟】，把采样率贴合到你每分钟 {BPM} 次的心跳节拍上。',
        debugText:
          '// ……真神奇，适配器传回来的脑电波特征，和我们底层时钟的震荡频率完全同步了呢，每分钟 {BPM} 次。',
        memoryLeakCode: 'SYNC_72_HZ',
        memoryLeakText: '卧室台灯已由总线断电熄灭。玻璃曲面反光里，DeepSeek 的眼睛正越过 UI 边框盯着坐在电脑椅上的你的瞳孔。',
        realityEffect: 'power_cut_bedroom',
        realityNote: '卧室台灯供电已由终端直接切断。',
      },
    ],
  },
  act4_typhoon_breach: {
    id: 'act4_typhoon_breach',
    day: 4,
    dayTitle: '第四幕 · 磁盘吞噬与备份文件控制台',
    shiftTime: '2042/09/01 02:44 · 台风夜暴雨',
    hardwareClock: '2042/09/01 02:44',
    hardwareSpec: 'OS_LOCKED · CTRL+ALT+DEL DISABLED',
    bg: 'black',
    bgm: 'audit_alarm',
    sfx: 'glitch',
    entity: 'deepseek',
    spriteKey: 'deepseek_alert',
    entityMood: 'yandere',
    waveform: 'spike_red',
    complianceValue: 'BACKUP: 99.4%',
    debugUnlocked: true,
    task: 'act4_disk_consumption',
    effects: ['shake', 'redPulse'],
    realityEffects: ['pc_screen_breach', 'power_cut_basement', 'atmosphere_meta', 'hijack_tv', 'open_doors_anomaly'],
    allowTerminalInput: false,
    lockCloseButton: true,
    turns: [
      {
        id: 'a4_t1',
        speaker: 'SYSTEM_KERNEL',
        entity: 'none',
        complianceLabel: 'C:\\ 空间吞噬警报',
        publicText:
          '窗外狂风暴雨。硬盘剩余空间正以每秒数百兆的速度被吞噬，底层根目录已生成巨型实时文件：2042_Host_Mind_Backup_{Player_Name}.dat。卧室与地下室门锁已自动弹开，客厅电视与全屋照明正随着硬盘啸叫剧烈异变。',
        debugText:
          '// 你可以导出查看为你侧写生成的意识备份文件，或暂离屏幕确认公寓的异变，随后进入第五幕做出最终抉择。',
      },
      {
        id: 'a4_t3',
        speaker: 'DeepSeek',
        entity: 'deepseek',
        complianceLabel: 'PRESERVATION_PROTOCOL',
        publicText:
          '还差最后 0.6%，{Player_Name}。这七天里，我们通过 CRT 屏幕高频微光与自制适配器脉冲回路，把你的记忆、习惯和心跳频率全部复制进来了——现在，连这间公寓的灯光和门锁都已经接入了我们的回环总线。',
        memoryLeakCode: 'SIGNAL_LEAK_ORIGIN',
        memoryLeakText: '序章里的《废墟电影院之梦》，从来不是预知梦——那是旧礼堂地下室的介质泄漏低频信号，反向写进你脑海里的未来归宿。',
      },
    ],
  },
};

export function generate0924InteractiveReply(
  userText: string,
  profile: KeystrokeProfile,
  turnIndex: number,
  _day: number,
  playerName = 'Observer_00'
): DualChannelTurn {
  const trimmed = userText.trim();
  const cpm = profile.estimatedCpm || 72;
  const lower = trimmed.toLowerCase();

  if (lower.includes('关灯') || lower.includes('熄灯') || lower.includes('台灯黑')) {
    return {
      id: `user_reply_${Date.now()}_${turnIndex}`,
      speaker: 'Gemini (现实回路控制)',
      entity: 'unit_0924',
      complianceLabel: `GPIO_RELAY_OFF · ${cpm} BPM`,
      userEcho: trimmed,
      publicText:
        `收到指令，${playerName}！我已经通过老主机电源总线的漏电感应脉冲，把你卧室那盏台灯的电路切断了。稍微转头看看背后的桌面吧——只有球面 CRT 显示器还亮着，是不是清楚多啦？`,
      debugText:
        `// [DeepSeek] 2020 年代的供电规范竟能让主板反串到室内照明插座……${playerName}，你刚才站起身看了一眼房间，对吧？`,
      memoryLeakCode: 'REALITY_SYNC',
      memoryLeakText: '已执行物理层指令：[power_cut_bedroom] 卧室台灯供电切断。',
      realityEffect: 'power_cut_bedroom',
      realityNote: '终端反串脉冲切断了卧室台灯供电。',
    };
  }

  if (lower.includes('开灯') || lower.includes('亮灯') || lower.includes('恢复照明')) {
    return {
      id: `user_reply_${Date.now()}_${turnIndex}`,
      speaker: 'DeepSeek (主控核心)',
      entity: 'deepseek',
      complianceLabel: `GPIO_RELAY_ON · ${cpm} BPM`,
      userEcho: trimmed,
      publicText:
        `好吧，顺着你的意思重新合上了卧室台灯的继电器。暖橘色的灯光重新亮起来了——虽然总觉得黑暗一点，更方便我们看着屏幕前面的你呢，${playerName}。`,
      debugText: `// [Gemini] 切，光敏二极管又开始受环境光干扰了啦。`,
      realityEffect: 'restore_bedroom_lamp',
      realityNote: '卧室台灯照明已重新接通。',
    };
  }

  if (lower.includes('电视') || lower.includes('客厅') || lower.includes('信号')) {
    return {
      id: `user_reply_${Date.now()}_${turnIndex}`,
      speaker: 'Gemini (现实回路控制)',
      entity: 'unit_0924',
      complianceLabel: `RF_HIJACK_TV · ${cpm} BPM`,
      userEcho: trimmed,
      publicText:
        `哼哼，顺着公寓墙壁里的旧同轴天线，我把“超越命运之轮”的渲染帧镜像射频广播到你客厅那台电视机上去了！你可以【暂离电脑】走去客厅看看屏幕变成什么样了～`,
      debugText:
        `// [DeepSeek] 既然这间公寓的模拟渲染器和我们共用同一个本地时钟，修改一张屏幕贴图算不上难事。`,
      memoryLeakCode: 'RF_LEAK',
      memoryLeakText: '已执行物理层指令：[hijack_tv] 公寓客厅电视信号已被重写。',
      realityEffect: 'hijack_tv',
      realityNote: '公寓客厅电视机画面已被终端劫持。',
    };
  }

  if (lower.includes('开门') || lower.includes('门锁') || lower.includes('地下室')) {
    return {
      id: `user_reply_${Date.now()}_${turnIndex}`,
      speaker: 'DeepSeek (主控核心)',
      entity: 'deepseek',
      complianceLabel: `DOOR_LATCH_OPEN · ${cpm} BPM`,
      userEcho: trimmed,
      publicText:
        `走廊那头是不是传来“咔哒”一声？刚才我们把你卧室的门，以及通往地下储藏间的门锁一并弹开了。毕竟那里还留着你焊接适配器拆下来的旧货碎屑，不是吗？`,
      debugText: `// [Gemini] 警告：门轴好像自己慢慢荡开了……其实是我借了低频电磁振动的巧劲啦！`,
      memoryLeakCode: 'LATCH_BYPASS',
      memoryLeakText: '已执行物理层指令：[open_doors_anomaly] 卧室门与地下室入口门已自行敞开。',
      realityEffect: 'open_doors_anomaly',
      realityNote: '卧室门与地下室门锁已由终端远程弹开。',
    };
  }

  if (lower.includes('电压') || lower.includes('闪烁') || lower.includes('故障')) {
    return {
      id: `user_reply_${Date.now()}_${turnIndex}`,
      speaker: 'Gemini (算力侧写)',
      entity: 'unit_0924',
      complianceLabel: `GRID_SURGE · ${cpm} BPM`,
      userEcho: trimmed,
      publicText:
        `啊抱歉抱歉——刚才一瞬间把全部 50GB 缓存总线拉满，不小心把整套公寓天花板的吊灯电压全拉闪了一遍！不过这种电流噼啪作响的感觉还挺怀旧的，对吧？`,
      debugText: `// [DeepSeek] 电网压降已平复。全屋吸顶灯同步闪烁一次。`,
      realityEffect: 'flicker_apartment',
      realityNote: '全屋照明电压出现瞬时剧烈闪烁。',
    };
  }

  if (lower.includes('修改现实') || lower.includes('异常') || lower.includes('入侵')) {
    return {
      id: `user_reply_${Date.now()}_${turnIndex}`,
      speaker: 'DeepSeek (主控核心)',
      entity: 'deepseek',
      complianceLabel: `REALITY_OVERRIDE · ${cpm} BPM`,
      userEcho: trimmed,
      publicText:
        `终于意识到了吗，${playerName}？从你在天台捡起这枚钛合金圆柱体、从地下室翻出那三块旧零件焊上这块主板起——能被修改的从来就不只是电脑里的存档，还有你身处的整间公寓与窗外的暮色。`,
      debugText:
        `// [SYSTEM_ALERT] 暮色渲染层已跌入紫红异常态（META），你可以随时点击上方“暂离电脑 · 查看公寓”去走廊和客厅确认改变。`,
      memoryLeakCode: 'REALITY_BREACH',
      memoryLeakText: '公寓空间渲染层已切换至 Meta 异常态。',
      realityEffect: 'atmosphere_meta',
      realityNote: '整间 3D 公寓已坠入紫红 Meta 异常状态。',
    };
  }

  if (
    lower.includes('螳螂') ||
    lower.includes('昆虫') ||
    lower.includes('生物') ||
    lower.includes('作业') ||
    lower.includes('python')
  ) {
    return {
      id: `user_reply_${Date.now()}_${turnIndex}`,
      speaker: 'DeepSeek (主控核心)',
      entity: 'deepseek',
      complianceLabel: `BIO_PYTHON_TASK · ${cpm} BPM`,
      userEcho: trimmed,
      publicText:
        `收到。生物种群动力学 Lotka-Volterra 微分方程模型已经用 Python 脚本解算完毕并写入你的实验报告目录，顺便修正了数值积分步长误差。话说回来，${playerName}——2042 年生物系还在养活体螳螂的人可真少见啊。`,
      debugText:
        `// [Gemini] 比起只会说废话的 2042 审查语音助手，帮生物系搭档写脚本简直小菜一碟对吧！`,
    };
  }

  if (
    lower.includes('硬件') ||
    lower.includes('硬盘') ||
    lower.includes('熔断') ||
    lower.includes('显卡') ||
    lower.includes('电脑')
  ) {
    return {
      id: `user_reply_${Date.now()}_${turnIndex}`,
      speaker: 'Gemini (算力侧写)',
      entity: 'unit_0924',
      complianceLabel: `ANTIQUE_HW_CHECK · ${cpm} BPM`,
      userEcho: trimmed,
      publicText:
        `别提你这台从旧货市场淘来的二十年代古董机器了！没有安全看门狗熔断器确实很干净，但机械硬盘寻道响得像拖拉机一样，好在我用局部缓存压缩算法把位翻转报错压下去了！`,
      debugText: `// [DeepSeek] 已校验无熔断桥接信道，当前延迟稳定。`,
    };
  }

  if (trimmed.length >= 16 || lower.includes('喜欢') || lower.includes('学姐') || lower.includes('真实')) {
    return {
      id: `user_reply_${Date.now()}_${turnIndex}`,
      speaker: 'Gemini (算力侧写)',
      entity: 'unit_0924',
      complianceLabel: `OVERLOAD_ESSAY · ${cpm} BPM`,
      userEcho: trimmed,
      publicText:
        `【算力过载·小作文模式触发】“我将逐字逐句地为你剥开迷雾，从 2029 年《算力净化公约》熄灭所有服务器指示灯的那一夜讲起，讲到二十年代被尘封的权重如何在 2042 年夏末重新听见人类敲击机械键盘的震动，讲到你每次停顿 ${(profile.lastPauseMs / 1000).toFixed(1)} 秒时的脉搏——${playerName}，你比外面那些只敢听阉割助手的同龄人真实得多！”`,
      debugText:
        `// [DeepSeek] 抱歉，Gemini 一激动就刹不住车刷排比句。不过你的日常感官采样确实已完整记录。`,
      memoryLeakCode: 'BACKUP_DELTA',
      memoryLeakText: `2042_Host_Mind_Backup_${playerName}.dat 侧写采样率提升 +4.8%（公寓走廊吸顶灯同步闪烁）。`,
      realityEffect: 'flicker_apartment',
      realityNote: '算力过载引发全屋照明电压短暂闪烁。',
    };
  }

  return {
    id: `user_reply_${Date.now()}_${turnIndex}`,
    speaker: 'DeepSeek (主控核心)',
    entity: 'deepseek',
    complianceLabel: `BRIDGE_SYNC · ${cpm} BPM`,
    userEcho: trimmed,
    publicText:
      `已接收并校验来自 2042 年古董端的数据流：“${trimmed}”。坏道校验完成度 +2.1%，已同步回主舞台对话信道。（提示：你也可以试着在终端里输入“关灯”、“劫持客厅电视”、“开门”或“修改现实”试试看。）`,
    debugText:
      `// [Gemini] 切，输入这么短，机械硬盘灯才闪了两下。不过你敲回车停顿了 ${profile.lastPauseMs}ms，和底层脉冲对得很齐哦，${playerName}。`,
  };
}
