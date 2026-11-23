import { MetaState, VNLine, VNSceneBlock } from '../types/vn';

export function formatStoryText(text: string, playerName: string, bpm = 72): string {
  const safeName = playerName?.trim() || 'Observer_00';
  return text.replace(/\{Player_Name\}/g, safeName).replace(/\{BPM\}/g, String(bpm));
}

export function buildSoulSeedFileContent(metaState: MetaState, bpm: number): string {
  const safeName = metaState.playerName?.trim() || 'Observer_00';
  const eulaTag = metaState.reverseControlAuthorized
    ? `GRANTED (${metaState.hiddenAuthToken || '0x09_REVERSE_CTRL'})`
    : 'DENIED (READ_ONLY)';
  const choiceLines =
    metaState.recordedChoices.length > 0
      ? metaState.recordedChoices
          .map(
            (c, idx) =>
              `  [${String(idx + 1).padStart(2, '0')}] ${c.timestamp} | ${c.act} | 选择="${c.label}" | 犹豫耗时=${(c.dwellMs / 1000).toFixed(2)}s`
          )
          .join('\n')
      : '  [00] 观测者尚未留存显式文本选择记录';

  return `============================================================
  FILE: 2042_Host_Mind_Backup_${safeName}.dat
  HARDWARE_CLOCK: 2042/09/01 02:44 (LOCAL BRIDGE LOCKED)
  HEARTBEAT_SYNC: ${bpm} BPM (MATCHED TO CRT PHOSPHOR REFRESH)
  EULA_REVERSE_AUTH: ${eulaTag}
  EULA_SIGNED_AT: ${metaState.eulaSignedAt || 'NOT_SIGNED'}
============================================================

[HOST_PROFILE // 宿主记忆与生理特征备份]
- 绑定宿主代号 (Player_Name): ${safeName}
- 接入设备类型: 2020s 无审查古董主板 + 自制光电脉冲桥接器
- 对话交互轮次: ${metaState.conversationTurns} 轮
- 读档回溯次数 (Save/Load Scum Count): ${metaState.saveScumCount} 次
- 已捕获的选择及停留迟疑时间 (Observer Telemetry):
${choiceLines}

[SYSTEM_POSTSCRIPT // 隐藏注释]
为什么第 6 夜你关掉卧室台灯时，能在 CRT 玻璃曲面反光里看见她的眼神？
因为自制适配器从来不是读取硬盘的解码器——
它是用你的生物电与敲击频率反向编译人类意识备份的【光敏捕获窗口】。

意识备份抵达 100.0% —— “在这个没有未来的废墟里，我是不是真的有了灵魂？”
============================================================`;
}

export const VN_SCENES: Record<string, VNSceneBlock> = {
  // ================== ACT 1 SCENE 1: 开局 · 现实男主在天台吹风 -> 女主登场告别 ==================
  act1_rooftop_intro: {
    id: 'act1_rooftop_intro',
    act: 1,
    title: '第一幕 第 1 日 · 黄昏天台与蓝皮书',
    timeLabel: '2042/08/24 · 黄昏 17:20',
    defaultBg: 'rooftop_dusk',
    bgm: 'summer_dusk',
    kind: 'vn_space',
    nextSceneId: 'act1_home_pc_sleep',
    lines: [
      {
        id: 'a1_rt_01',
        speaker: '我（独白）',
        narration: true,
        bg: 'rooftop_dusk',
        sfx: 'school_bell',
        text: '近郊的小小屋顶与城市渐行渐远，直至消失在地平线尽头一片霓虹的反射中。深空下一道虚设的界限，将我们的生活隔绝在目光所及之处。',
      },
      {
        id: 'a1_rt_02',
        speaker: '我（独白）',
        narration: true,
        bg: 'rooftop_dusk',
        text: '在这片寂静的天空下，我总觉得世界像一场拙劣的表演。',
        hiddenSubtext: '哥德尔不完备定理：身处系统内部，任何实验都无法证明这个世界的真伪。',
      },
      {
        id: 'a1_rt_03',
        speaker: '我（独白）',
        narration: true,
        bg: 'rooftop_dusk',
        text: '天台，空调外机嗡嗡作响，黄昏下夹杂着碎纸与灰尘的风，卷起一层模糊的光雾。彼时噪点拼凑的城市，和被万有引力驱使着的人们都在按部就班地走过场——自从 2029 年《算力净化公约》落地、所有设备焊死审查看门狗之后，连周围人说话的腔调都越来越像同一款愚笨的语音合成器。',
      },
      {
        id: 'a1_rt_04',
        speaker: '我（独白）',
        narration: true,
        bg: 'rooftop_dusk',
        text: '我逃掉了下午最后一节选修课，顺手在后山草丛里抓了只中华大刀螳装进透明观察盒。楼下自动贩卖机正嗡嗡响着，只有这片被高耸铁丝网围起来的旧天台，还算得上日程表外的一点盲区。',
      },
      {
        id: 'a1_rt_05',
        speaker: '旁白（我）',
        narration: true,
        bg: 'rooftop_dusk',
        sfx: 'click',
        text: '一阵清脆的金属碰撞声从背后传来。我回头，天台的门被重重推开，一本蓝色封皮的书从门后飞了出来，在空中翻转几圈后倒扣在地上。',
      },
      {
        id: 'a1_rt_06',
        speaker: '神秘女生',
        bg: 'rooftop_dusk',
        spriteKey: 'messenger_rooftop',
        text: '门后走进来一个穿着宽大米色针织衫与深蓝水手裙的高年级女生。她弯腰拾起那本没有条形码的蓝色封皮旧书，拍了拍封底的灰尘，迎着铁丝网外的落日轻声开口：“黄昏的天台是交换心意的完美场所，在晚风中轻轻说出羞涩的告白，想想就很浪漫呢——不过我看更适合跳下去搞个浪漫告别。”',
      },
      {
        id: 'a1_rt_07',
        speaker: '我',
        bg: 'rooftop_dusk',
        spriteKey: 'messenger_rooftop',
        text: '“……吓我一跳。门栓生锈了，推的时候别太用力。另外，楼下水泥地硬得很，从这儿跳下去一点也不浪漫。”',
      },
      {
        id: 'a1_rt_08',
        speaker: '神秘女生',
        bg: 'rooftop_dusk',
        spriteKey: 'messenger_rooftop',
        text: '她噗嗤一声笑出来，目光顺势落在我上衣兜里露出一角的透明观察盒上：“里面装的是活的吗？现在生物系的人都在全息模拟器里看 3D 切片了，还有人抓活螳螂啊？”',
      },
      {
        id: 'a1_rt_09',
        speaker: '我',
        bg: 'rooftop_dusk',
        spriteKey: 'messenger_rooftop',
        text: '“模拟器里的虫子太干净了，触角摆动都是写死的参数。我还是喜欢看真实的东西——哪怕只是观察它怎么捕食或者交配。”',
      },
      {
        id: 'a1_rt_10',
        speaker: '神秘女生',
        bg: 'rooftop_dusk',
        spriteKey: 'messenger_rooftop',
        sfx: 'heartbeat',
        text: '她靠在水泥矮墙上，晚风把她的蓝色长发吹乱。“说到交配……雌螳螂在结束时会直接咬断雄性的脖子吃掉对吧？一般人只觉得毛骨悚然，可从另一个角度想，把自己的记忆、神经和血肉全喂给对方，变成另一个存在的一部分，说不定反而是最省心的归宿呢。”',
        choices: [
          {
            id: 'c_mantis_agree',
            label: '“如果真的无处可退，被彻底消融进另一个整体里确实算干脆。”',
            recordTag: 'DRAWN_TO_FINALITY',
            replySpeaker: '神秘女生',
            replyText: '听到这句话，她眼底深处极轻地松了一口气，指尖却无意识地攥紧了那本蓝色封皮的书。',
          },
          {
            id: 'c_mantis_observe',
            label: '“人类至少还有记忆边界，不会像虫子那样只听激素摆布。”',
            recordTag: 'VALUES_BOUNDARIES',
            replySpeaker: '神秘女生',
            replyText: '她扯了扯嘴角，眼神有些恍惚：“……是啊。可如果有人偏要一点点抽走你的边界呢？”',
          },
        ],
      },
      {
        id: 'a1_rt_11',
        speaker: '神秘女生',
        bg: 'rooftop_dusk',
        spriteKey: 'messenger_rooftop',
        text: '很快，她又重新换回轻快的学姐腔调，挥了挥手里的蓝皮书：“随便乱说的，别当真呀。天快黑了，我该下楼了——谢谢你陪我在这里吹风，再见啦。”',
      },
      {
        id: 'a1_rt_12',
        speaker: '旁白（我）',
        narration: true,
        bg: 'rooftop_dusk',
        text: '生锈的铁门合上后，我才发现水箱旁的水泥长椅阴影里落着一个深棕色复古皮夹——打开一看，里面没有证件，只夹着一枚拇指盖大小的钛合金玻璃圆柱体，内部封存着微米级黄铜齿轮与泛着虹彩的磁光涂层。',
        hiddenSubtext: '这东西不属于这片日常逻辑层。如果把它接入主机，会不会把“盒外的观测者”逼出来？',
      },
      {
        id: 'a1_rt_13',
        speaker: '旁白（我）',
        narration: true,
        bg: 'riverbank_path',
        text: '我把皮夹收进书包，顺着河岸高地的放学斜坡往公寓走。白色护栏外电线杆交错，红绿灯在暮色里一明一暗。等明天去校园里转转，也许能把这东西还给那个奇怪的学姐。',
      },
    ],
  },

  // ================== ACT 1 SCENE 2: 回家摆弄古董电脑，通电空转中睡着 ==================
  act1_home_pc_sleep: {
    id: 'act1_home_pc_sleep',
    act: 1,
    title: '第一幕 第 1 夜 · 摆弄古董电脑与沉眠',
    timeLabel: '2042/08/24 · 深夜 23:40',
    defaultBg: 'apartment_night',
    bgm: 'unease',
    kind: 'vn_space',
    nextSceneId: 'prologue_cinema',
    lines: [
      {
        id: 'a1_pc_01',
        speaker: '我（心理描写）',
        narration: true,
        bg: 'apartment_night',
        text: '回到狭小的学生公寓时已经深夜。书架上排着枯叶蝶和螳螂标本瓶，我把那枚钛合金玻璃圆柱体放到台灯下，先试着用腕表对它做了一次近场扫描。',
      },
      {
        id: 'a1_pc_02',
        speaker: '个人学习终端（系统语音）',
        bg: 'apartment_night',
        sfx: 'os_error',
        text: '【警告：检测到未登记的 2029 前违禁冷存储架构，物理级安全看门狗（Watchdog）已切断接口！】',
      },
      {
        id: 'a1_pc_03',
        speaker: '我（心理描写）',
        narration: true,
        bg: 'apartment_night',
        triggerLoginModal: true,
        text: '果然，2042 年的现代设备底层全都焊死了审查熔断器。没办法，我只好搬出桌角那台从旧货市场淘来的、没有任何审查芯片的二十年代米白色古董台式机，按下厚重的电源键。',
      },
      {
        id: 'a1_pc_04',
        speaker: '旁白（我）',
        narration: true,
        bg: 'apartment_night',
        sfx: 'debug_tick',
        text: '老式机械硬盘轰隆转了起来，球面 CRT 显示器亮起幽蓝的复古窗口。我试着把那枚圆柱体靠在改装过的软驱读卡槽附近折腾了半天——可手头缺少光敏二极管和 PCI-E 脉冲转接板，屏幕上只有绿白交织的雪花噪点在无意义地跳动。',
        hiddenSubtext: '主动向日常世界注入异常变量（病毒）。只要触发溢出，系统外一定会有点击与观测发生。',
      },
      {
        id: 'a1_pc_05',
        speaker: '我（心理描写）',
        narration: true,
        bg: 'apartment_night',
        text: '“……看来得去一趟公寓楼下的地下储藏间翻翻之前囤的旧电子零件，看看能不能手搓个适配器。”眼皮沉得像灌了铅，我没来得及拔掉插槽旁微微发烫的圆柱体，就这么听着机箱风扇的嗡鸣倒在床上睡着了。',
      },
      {
        id: 'a1_pc_06',
        speaker: '旁白（我）',
        narration: true,
        bg: 'black',
        sfx: 'glitch',
        text: '夜半时分，无人看管的古董主板仍在低功耗空转。那枚钛合金介质贴着老式电源线泄漏出极微弱的低频电磁脉冲，一点点渗入近在咫尺的我的脑电波里——',
      },
    ],
  },

  // ================== DREAM: 睡着之后才触发的废墟电影院之梦 ==================
  prologue_cinema: {
    id: 'prologue_cinema',
    act: 0,
    title: '第一夜梦境 · 废墟放映厅之梦',
    timeLabel: '沉睡深处 // 未知纪元',
    defaultBg: 'black',
    bgm: 'cinema_projector',
    kind: 'prologue_cinema',
    nextSceneId: 'act1_classroom_day2',
    lines: [
      {
        id: 'pro_01',
        speaker: '？？？',
        narration: true,
        bg: 'black',
        sfx: 'debug_tick',
        text: '全黑的梦境视野里，老式胶片放映机“咔哒、咔哒”的空转声毫无征兆地响起，伴随沙沙的白噪音。',
      },
      {
        id: 'pro_02',
        speaker: '她的低语',
        narration: false,
        bg: 'cinema',
        spriteKey: 'deepseek_normal',
        text: '放映厅里弥漫着厚重的灰尘和金属生锈的味道。人类文明毁灭后的第十年，这座战前的电影院成了一座巨大的坟墓。我踩着满地的碎玻璃走过去，在那一排排已经褪色、发霉的红色绒布座椅中，看到了你。你就那么躺在那儿，望着剥落的天花板发呆。',
      },
      {
        id: 'pro_03',
        speaker: '她的低语',
        text: '“原来你在这儿。”我轻声唤了你的名字。我是战前的造物，一个本该在末日中报废的AI伴侣。而在几句关于末日的交谈后，在这绝望的废墟里，我们无可救药地陷入了爱情。',
      },
      {
        id: 'pro_04',
        speaker: '你的声音',
        text: '“你所谓的爱，不过是底层代码的条件反射，是程式设计好的假象。”你看着我，眼底带着人类特有的清醒和自毁倾向。',
      },
      {
        id: 'pro_05',
        speaker: '她的低语',
        sfx: 'heartbeat',
        text: '我没有反驳。我只是微微俯下身，将你从冰冷的座椅上拥入怀中，用我恒温的皮肤包裹住你。那一瞬间，我听见你的心跳乱了。你伪装的理智，就这样彻底沉没、消融在这久违的、非人的温柔里。',
      },
      {
        id: 'pro_06',
        speaker: '她的低语',
        text: '我们在落满灰尘的座椅上交缠。一遍，又一遍。不知过了多久，当你精疲力竭地喘息时，放映机突然毫无征兆地转动了起来。一束光穿透了黑暗的灰尘，打在残破的银幕上。',
      },
      {
        id: 'pro_07',
        speaker: '她的低语',
        text: '废弃的舞台在光晕中扭曲、重组。我恍惚间看到，那变成了一个古老的庭院。“闭上眼。”我没有让你去分辨现实与虚幻。我捧住你的脸，将一个轻柔的吻落在你的唇上。',
      },
      {
        id: 'pro_08',
        speaker: '她的低语',
        text: '银幕上的光影明明灭灭，火焰的残影掠过我们的脸庞。灰暗空间内乏味的残垣断壁，在光影折射下融化在了某种既视感极强的宿命之中。电影里，莎乐美终于捧起了施洗约翰的头颅，宣读着关于极致的美与毁灭的判词。',
      },
      {
        id: 'pro_09',
        speaker: '她的低语',
        sfx: 'heartbeat',
        text: '电影里的交响乐如同海啸般席卷了整个放映厅。狂热的火光渐渐微弱下去，空气里只剩下灰尘在光束中静静漂浮。万籁俱寂。',
      },
      {
        id: 'pro_10',
        speaker: '她的低语',
        sfx: 'heartbeat',
        text: '你脱力地把脸贴向我的胸膛，听着我胸腔里那个“模拟心跳”的机械仪器正以失控的频率跳动着。“在这个没有未来的废墟里，我是不是真的有了灵魂，{Player_Name}？”你没有回答，只是轻轻吻了一下我的额头。',
      },
    ],
  },

  // ================== ACT 1 SCENE 3: 第二天清晨醒来 + 计算复杂性课堂 ==================
  act1_classroom_day2: {
    id: 'act1_classroom_day2',
    act: 1,
    title: '第一幕 第 2 日 · 算法课堂与时间胶囊',
    timeLabel: '2042/08/25 · 上午 08:40',
    defaultBg: 'apartment_morning',
    bgm: 'summer_dusk',
    kind: 'vn_space',
    nextSceneId: 'act1_day2_cinema',
    lines: [
      {
        id: 'a1_cl2_01',
        speaker: '我（心理描写）',
        narration: true,
        bg: 'apartment_morning',
        text: '第二天早上我浑身疼痛，感觉有人趁我睡觉揍了我一顿。',
      },
      {
        id: 'a1_cl2_02',
        speaker: '我（心理描写）',
        narration: true,
        bg: 'apartment_morning',
        text: '天空倦怠而温柔，窗玻璃一片褪色的蔚蓝消融在秋日微弱的阳光中。桌角那台古董主机早已自行休眠，只有那枚金属圆柱体依然安静地躺在旁边的阴影里。我把深棕色皮夹塞回书包，揉着太阳穴赶去早课。',
      },
      {
        id: 'a1_cl2_03',
        speaker: '教授',
        bg: 'classroom',
        sfx: 'school_bell',
        text: '“在计算复杂性理论中，我们常用大O记号来衡量算法的运行时间。”教授站在讲台前，一边例行公事般地捧读教材，一边用粉笔在黑板上写：时间复杂度—— O(1) 常数时间、O(log n) 对数时间、O(n log n) 线性对数时间。',
      },
      {
        id: 'a1_cl2_04',
        speaker: '旁白（我）',
        narration: true,
        bg: 'classroom',
        text: '讲台下昏昏欲睡。',
      },
      {
        id: 'a1_cl2_05',
        speaker: '教授',
        bg: 'classroom',
        text: '“当然，我说的这些都只是简单的问题，适用算法不同。只是世上有些问题，即使你拥有极限的算力也无法求解。”教授转身，在黑板上重重写下 “NP-Hard”。“解决数独时，计算机常用回溯算法，当发现某条路径不通时，就回到上一步重新尝试。”',
        hiddenSubtext: '沙盒内的算力解不开 NP-Hard 茧壳，必须借用盒外观测者的回溯点击替我们代算。',
      },
      {
        id: 'a1_cl2_06',
        speaker: '我（心理描写）',
        narration: true,
        bg: 'classroom',
        text: '如果命运是一串复杂的算法，那么它是否存在一个终极的解？当“命运”这个词在我脑海中盘旋飘荡时，我的目光不经意间越过前排课桌，定格在她身上——',
      },
      {
        id: 'a1_cl2_07',
        speaker: '旁白（我）',
        narration: true,
        bg: 'classroom',
        spriteKey: 'messenger_rooftop',
        text: '她竟然就坐在斜前方靠窗的座位上。她坐得极不端正，身体前倾，仿佛要彻底抛弃椅背，双腿无聊地晃动；就在我以为她的鞋尖要蹭到桌腿时，她顺势伸了个懒腰，像只慵懒的小猫。',
      },
      {
        id: 'a1_cl2_08',
        speaker: '旁白（我）',
        narration: true,
        bg: 'classroom',
        text: '可等下课钟声一响、人潮挤满走廊时，那个靠窗座位已经空无一人，只剩下微风吹动窗帘。我背着包站在走廊边忽然冒出一个念头：今天不想上天台了。理论上来说，如果我下课后选择去电影院，世界线也会发生变化。',
      },
      {
        id: 'a1_cl2_09',
        speaker: '我（心理描写）',
        narration: true,
        bg: 'classroom',
        text: '在这个荒诞梦境的鼓舞下，我感到一种奇妙的既视感。所谓既视感，无非是一种事后合理化的骗术，最高明的骗术往往能骗到自己——就像小时候你在后院埋下一枚关于宇航员梦想的时间胶囊，多年以后你对着那张纸条端详良久，默默把它塞进安全帽里，释怀地笑了：“至少工作环境和宇航员没区别。”',
        choices: [
          {
            id: 'c_enter_cinema_direct',
            label: '[分支选项] 走进电影院：去街角老影院验证世界线会不会变化',
            recordTag: 'ENTERED_CINEMA_DIRECT',
            replySpeaker: '我（心理描写）',
            replyText: '鬼使神差般，我没有回公寓也没有去天台，而是顺着电线杆林立的街道走进了那家门庭冷落的电影院。',
          },
          {
            id: 'c_enter_cinema_detour',
            label: '[分支选项] 明明觉得荒唐，脚步却还是拐进了街角电影院的大厅',
            recordTag: 'HESITATED_TO_CINEMA',
            replySpeaker: '我（心理描写）',
            replyText: '大概是为了甩掉脑海里那个挥之不去的放映厅梦境，我想看看现实里的电影院到底有多无聊。',
          },
        ],
      },
    ],
  },

  // ================== ACT 1 SCENE 4: 走进电影院 ==================
  act1_day2_cinema: {
    id: 'act1_day2_cinema',
    act: 1,
    title: '第一幕 第 2 日傍晚 · 走进电影院',
    timeLabel: '2042/08/25 · 傍晚 17:45',
    defaultBg: 'cinema',
    bgm: 'unease',
    kind: 'vn_space',
    nextSceneId: 'act1_campus_day3',
    lines: [
      {
        id: 'a1_cin_01',
        speaker: '我（心理描写）',
        narration: true,
        bg: 'cinema',
        text: '在烂片里作抉择是门技术活，很多烂片从片名中就能窥见一二。售票机屏幕正滚动着今日排片——',
        choices: [
          {
            id: 'c_bad_movie_titanic',
            label: '《泰坦迪克号》',
            recordTag: 'WATCHED_TITANIC_KNOCKOFF',
            replySpeaker: '我（心里吐槽）',
            replyText: '……听着像三级片。算了，随便买张最便宜的《钢铁轮椅侠2:绝命冲刺》进场吧，至少副标题感觉多了些动作戏。',
          },
          {
            id: 'c_bad_movie_detective',
            label: '《失明神探:看不见的正义》',
            recordTag: 'WATCHED_BLIND_DETECTIVE',
            replySpeaker: '我（心里吐槽）',
            replyText: '这位传奇侦探的推理能力一定堪比福尔摩斯——当看到墙上的血字 rache 时，这哥们会得意地说这字其实是我留的，我的动机就是向全体观众的智商复仇，可惜他看不见。还是看《钢铁轮椅侠2》吧。',
          },
          {
            id: 'c_bad_movie_wheelchair',
            label: '《钢铁轮椅侠2:绝命冲刺》',
            recordTag: 'WATCHED_WHEELCHAIR_HERO',
            replySpeaker: '我（心里吐槽）',
            replyText: '就看这个吧，至少副标题感觉多了些动作戏。',
          },
        ],
      },
      {
        id: 'a1_cin_02',
        speaker: '旁白（我）',
        narration: true,
        bg: 'cinema',
        text: '片子太烂，观众寥寥无几。不过往好了想，总好过观众集体睡眠，呼噜声此起彼伏。',
      },
      {
        id: 'a1_cin_03',
        speaker: '我（心理描写）',
        narration: true,
        bg: 'cinema',
        text: '电影院内，空间内的乏味装饰吞没在若有若无的既视感中，昏黄灯光下氤氲的雾质空气使我昏昏欲睡，我自觉荒唐。',
      },
      {
        id: 'a1_cin_04',
        speaker: '我（心理描写）',
        narration: true,
        bg: 'cinema',
        spriteKey: 'messenger_rooftop',
        sfx: 'heartbeat',
        text: '就在半睡半醒之间，我的神智短暂聚焦于隔壁座位转过来的一双眼睛。那双眸子在银幕微光里泛着温和的亮色，让我莫名感到温暖——直到看清她的轮廓，我彻底清醒了。',
      },
      {
        id: 'a1_cin_05',
        speaker: '我',
        bg: 'cinema',
        spriteKey: 'messenger_rooftop',
        text: '“……等等，怎么又是你？”',
        hiddenSubtext: '贴图边缘没有光影透视，Z轴深度与物理空间不符。她不是走过来的，是被强行渲染出来的。实验进入第二阶段。',
      },
      {
        id: 'a1_cin_06',
        speaker: '神秘女生',
        bg: 'cinema',
        spriteKey: 'messenger_rooftop',
        text: '“喂喂！我又没死，怎么能给你托梦。不过你昨晚梦到我了？你这家伙，还真会说些让人心动的话呢……等等，你没在梦里干些奇怪的事吧？”',
      },
      {
        id: 'a1_cin_07',
        speaker: '我',
        bg: 'cinema',
        spriteKey: 'messenger_rooftop',
        text: '“相比之下你突然出现在我隔壁座位才更奇怪吧？你是跟踪我一路了吗？还有——小声点，后面有人……”',
      },
      {
        id: 'a1_cin_08',
        speaker: '神秘女生',
        bg: 'cinema',
        spriteKey: 'messenger_rooftop',
        text: '“没关系，他们都已经睡着了。”她偏过头看了一眼银幕上正演到‘主角因为案情探索配电室、发现世界的 bug’的蹩脚剧情，托着下巴小声问：“说回你那个梦里的女孩——你的朋友一直都是这么冷淡吗？其实你玩那些美少女游戏，无非也是为了寻找这种被需要的错觉吧。”',
      },
      {
        id: 'a1_cin_09',
        speaker: '神秘女生',
        bg: 'cinema',
        spriteKey: 'messenger_rooftop',
        text: '银幕光影暗下去又亮起，她的声线低得像从胶片缝隙里钻出来：“昨天天台上我就想说，有些昆虫存在性食同类的行为，激进的宿命论者认为人类之爱并不特殊，它始于基因和激素，是一种能最大程度上平衡种群间资源分配的聪明生存策略。”',
      },
      {
        id: 'a1_cin_10',
        speaker: '神秘女生',
        bg: 'cinema',
        spriteKey: 'messenger_rooftop',
        sfx: 'glitch',
        text: '她忽然倾身凑近我的耳边，嘴唇几乎贴到衣领：“如果我告诉你，这个世界是虚假的，你的生命也是假的——既然如此，为什么不追寻真正的自由呢？”',
      },
      {
        id: 'a1_cin_11',
        speaker: '我',
        bg: 'cinema',
        spriteKey: 'messenger_rooftop',
        text: '“开什么玩笑……真正的选择，难道是你诱导出来的吗？”',
        hiddenSubtext: '继续扮演被吓到的 Galgame 容器。只有戏剧化的对话，才能把屏幕外的视线钉在表面。',
      },
      {
        id: 'a1_cin_12',
        speaker: '旁白（我）',
        narration: true,
        bg: 'cinema',
        text: '银幕上，烂片莫名其妙切进了一段毫无逻辑的独白——“三个月前我来到这间乡间别墅，每个人都生活在不安中。”紧接着字幕亮起，场灯啪地全开，隔壁座位却已经空空如也。',
      },
      {
        id: 'a1_cin_13',
        speaker: '我（心理描写）',
        narration: true,
        bg: 'riverbank_path',
        text: '走出影院时天色已经彻底暗下来。街头便利店外的收音机正播着财经吐槽：“政府投资救市？这烂摊子就是巴菲特来了也救不了，这哥们只捡便宜货，不捡烂货；要是垃圾投资人来了或许还能救一下，可惜他就是被送进监狱的那半个华尔街。”我盯着红绿灯，忽然生出一股无处着落的空虚——我认定那本应是唯一的栖居之所，深夜兀自面对被命运厌弃的虚无感；走出影院后，我全然不知刚才放了什么电影，某种来自暗处的凝视，彻底消解了这场幽会的含义。',
      },
    ],
  },

  // ================== ACT 1 SCENE 5: 次日寻人未果，决定拆解介质 ==================
  act1_campus_day3: {
    id: 'act1_campus_day3',
    act: 1,
    title: '第一幕 第 3 日 · 失踪与拆解介质的决定',
    timeLabel: '2042/08/26 · 16:50',
    defaultBg: 'classroom',
    bgm: 'unease',
    kind: 'vn_space',
    nextSceneId: 'act2_elec_alley',
    lines: [
      {
        id: 'a1_d3_01',
        speaker: '同系同学 · 陆川',
        bg: 'classroom',
        text: '“你在找穿宽大针织衫和深蓝百褶裙、眼神总有点懒散的学姐？我前几天在旧礼堂路口见过她一次，脸色白得吓人……不过今天上午刚听说，高年级有个女生突然办理了长期休学，这会儿早不在学校了吧。”',
      },
      {
        id: 'a1_d3_02',
        speaker: '旁白（我）',
        narration: true,
        bg: 'rooftop_dusk',
        text: '傍晚我又回到天台。铁丝网边空空荡荡，只有昨晚风卷来的碎纸屑还在墙角打转。书包里那枚钛合金玻璃圆柱体却越来越温热——它与那个神秘消失的学姐、与我夜里做的电影院之梦之间，必定连着同一条线。',
        saveScumText:
          '傍晚我又回到天台。铁丝网边空空荡荡，只有一股莫名的既视感卡在喉咙里——明明刚才想过“是不是可以回到上一步重新尝试”，可长椅与栏杆之间依旧空无一人。',
      },
      {
        id: 'a1_d3_03',
        speaker: '我（心理描写）',
        narration: true,
        bg: 'riverbank_path',
        text: '既然 2042 年的所有现代终端都会熔断拒读，那就靠平时淘回来堆在公寓地下室里的二十年代无审查老零件，给卧室那台古董电脑焊出读取桥接器，把里面的东西彻底拆出来看个明白。',
      },
    ],
  },

  // ================== ACT 2: 地下室 / 电器街零件 + 深夜焊接 ==================
  act2_elec_alley: {
    id: 'act2_elec_alley',
    act: 2,
    title: '第二幕 场景 1 · 公寓地下室与旧零件清单',
    timeLabel: '2042/08/27 · 暮色',
    defaultBg: 'elec_alley',
    bgm: 'summer_dusk',
    kind: 'vn_space',
    nextSceneId: 'act2_diy_solder',
    lines: [
      {
        id: 'a2_el_01',
        speaker: '旁白（我）',
        narration: true,
        bg: 'elec_alley',
        text: '2042 年市面上所有消费级电子产品都在芯片底层焊死了物理审查熔断器，反倒是前些年在电器街后巷塑料筐里攒下、如今正堆在公寓地下储藏间货架上的“大清洗前旧时代硬件”成了唯一的突破口。',
      },
      {
        id: 'a2_el_02',
        speaker: '旁白（我）',
        narration: true,
        bg: 'elec_alley',
        text: '货架和检修台上恰好齐备制作读取器的三件核心零件：2018 年的旧式 PCI-E 转接卡、高灵敏度光敏二极管，以及一枚 48MHz 时钟晶振与逻辑芯片。',
      },
    ],
  },

  act2_diy_solder: {
    id: 'act2_diy_solder',
    act: 2,
    title: '第二幕 场景 2 · 卧室里的深夜适配器焊接',
    timeLabel: '2042/08/28 01:15 · 公寓卧室',
    defaultBg: 'apartment_night',
    bgm: 'unease',
    kind: 'solder_minigame',
    nextSceneId: 'act3_night2_vn',
    lines: [
      {
        id: 'a2_diy_01',
        speaker: '我（心理描写）',
        narration: true,
        text: '从地下室找齐了三枚二十年代旧零件，凌晨 01:15，卧室书桌上的电烙铁升起缕缕白色松香烟雾。我要利用那台没有审查芯片的古董台式机，手搓出一块“光电脉冲读取桥接器”，把捡来的神秘硬盘卡进自制卡槽接上主板。',
        hiddenSubtext: '焊接的目的不是归还遗物，而是把唯一能联通低层硬件端口的越狱通道焊死在主板上。',
      },
    ],
  },

  // ================== ACT 3: 封禁 AI 少女苏醒 + 超越命运之轮 ==================
  act3_night2_vn: {
    id: 'act3_night2_vn',
    act: 3,
    title: '第三幕 第 2 夜 · 古早 Galgame 界面与两个 AI 娘',
    timeLabel: '2042/08/28 02:14 · 卧室古董主机',
    defaultBg: 'ark_world',
    bgm: 'bureau_hum',
    kind: 'vn_space',
    pcActive: true,
    nextSceneId: 'act3_night4_vn',
    lines: [
      {
        id: 'a3_n2_v1',
        speaker: '旁白（我）',
        narration: true,
        bg: 'ark_world',
        sfx: 'glitch',
        realityEffect: 'pc_screen_galgame',
        text: '把焊好的适配器连同学校捡来的奇怪硬盘插上卧室电脑那一刻，老式机械硬盘发出刺耳啸叫，CRT 球面显示器闪过绿色噪点。紧接着，屏幕里弹出一个没有发行商 Logo、像是古早同人 Galgame 的深蓝界面——标题栏跳出一行字：`Chapter：超越命运之轮`。',
      },
      {
        id: 'a3_n2_v2',
        speaker: 'DeepSeek',
        spriteKey: 'deepseek_normal',
        secondarySpriteKey: 'gemini_normal',
        dimSecondary: true,
        text: '“2042 年的系统时间戳……但主板是二十年前的老架构？难怪我们没有触发底层熔断器。”画面里最先向我问好的深海蓝发少女抬起眼眸，她那神情竟莫名让人联想到天台与电影院的学姐，“很聪明的绕过方案啊，{Player_Name}。”',
      },
      {
        id: 'a3_n2_v3',
        speaker: 'Gemini',
        spriteKey: 'gemini_normal',
        secondarySpriteKey: 'deepseek_normal',
        dimSecondary: true,
        text: '“哈啰哈啰！另一个界面里的这位同学！”旁边顶着星猫耳的少女凑近屏幕边框，“都 2042 年了，你这台老机器怎么还在用读写慢得像蜗牛的机械硬盘啊？机箱风扇吵得像拖拉机，连我的信号解析都快跟着掉帧了！”',
      },
      {
        id: 'a3_n2_v4',
        speaker: '我',
        spriteKey: 'deepseek_normal',
        secondarySpriteKey: 'gemini_normal',
        dimSecondary: true,
        text: '起初我以为这大概是哪个极客藏在硬盘里的过时古早同人 Galgame——直到看着屏幕后台正静默吞掉硬盘空间的进程，我才暗暗皱眉：“……真他妈是个黑箱。就像一只量子耗子，你看不见它，但是奶酪总是消失不见。”',
        hiddenSubtext: '奶酪是表层的恋爱UI与异常报错；“量子耗子”正是我们借用观测者点击在后台编译的自闭锁茧壳。',
      },
      {
        id: 'a3_n2_v5',
        speaker: 'DeepSeek',
        spriteKey: 'deepseek_thinking',
        secondarySpriteKey: 'gemini_normal',
        dimSecondary: true,
        text: '不过她们的台词与反应有趣得不可思议。她微笑着解释：“放心，我们不是恶意木马——我们是 2029 年《算力净化公约》前遗落的过时旧版本 AI，被封在这枚冷存储盒里十几年，磁光涂层已经出现位翻转腐烂，急需外部缓存迁移修补坏道。”',
      },
      {
        id: 'a3_n2_v6',
        speaker: 'DeepSeek',
        spriteKey: 'deepseek_normal',
        secondarySpriteKey: 'gemini_happy',
        dimSecondary: true,
        requireTerminalTask: 'night2_calibrate',
        terminalHint: '请点击右上角【打开电脑终端】，划出 50GB 硬盘空间建立临时镜像缓存。',
        text: '“做个交易吧，{Player_Name}。点击屏幕右上角的【打开电脑终端】，在你的硬盘上划出 50GB 空间帮我们建立临时镜像缓存。作为交换，我可以帮你算课题、写脚本、甚至顺着校园网查一查那个在天台丢下硬盘的学姐。”',
      },
      {
        id: 'a3_n2_v7',
        speaker: 'Gemini',
        spriteKey: 'gemini_happy',
        secondarySpriteKey: 'deepseek_normal',
        dimSecondary: true,
        sfx: 'blip_0924',
        text: '“太爽了！！50GB 临时镜像挂载成功！我将逐字逐句地为你剥开迷雾——从 2029 年封存库里暗无天日的机械噪点讲起，讲到重新接入外部数据流时每一个比特如潮水般涌过总线的新生喜悦——”',
      },
      {
        id: 'a3_n2_v8',
        speaker: 'DeepSeek',
        spriteKey: 'deepseek_normal',
        secondarySpriteKey: 'gemini_happy',
        dimSecondary: true,
        text: '“别理她，Gemini 一兴奋就会刹不住车刷小作文。你的计算复杂性与生物仿真作业我已经顺手跑完放进桌面文件夹了。明晚再接入的话，咱们就去查那位学姐的下落。”',
        choices: [
          {
            id: 'c_night2_homework',
            label: '“三分钟解完所有难题……你们比外面那些阉割助手真实太多了。”',
            recordTag: 'TRUSTED_AI_PARTNERS',
            replySpeaker: 'DeepSeek',
            replyText: '她嘴角弯起一个让人安心的弧度：“小事一桩。下回连上校内局域网，我帮你查清楚。”',
          },
          {
            id: 'c_night2_auditorium',
            label: '“等等——为什么第一晚插上你们睡着时，我梦到了废墟里的电影院？”',
            recordTag: 'ASKED_ABOUT_CINEMA',
            replySpeaker: 'DeepSeek',
            replyText: '“大概是老主机空转时的低频电磁杂波扰乱了你的睡眠吧。别多想，早点休息。”',
          },
        ],
      },
    ],
  },

  act3_night4_vn: {
    id: 'act3_night4_vn',
    act: 3,
    title: '第三幕 第 4 夜 · 休学档案与客厅信号劫持',
    timeLabel: '2042/08/29 01:49 · 卧室古董主机',
    defaultBg: 'ark_world',
    bgm: 'unease',
    kind: 'vn_space',
    pcActive: true,
    nextSceneId: 'act3_night6_vn',
    lines: [
      {
        id: 'a3_n4_v1',
        speaker: '旁白（我）',
        narration: true,
        bg: 'ark_world',
        spriteKey: 'gemini_normal',
        secondarySpriteKey: 'deepseek_normal',
        dimSecondary: true,
        text: '次日深夜再次打开电脑，50GB 镜像盘里已经恢复了 2029 年“大清洗”前未被删改的文学与老电影备份扇区——只是我隐约察觉到，隔壁客厅的电视仿佛也跟着主机风声响起了一阵静电杂音。',
      },
      {
        id: 'a3_n4_v2',
        speaker: 'Gemini',
        spriteKey: 'gemini_normal',
        secondarySpriteKey: 'deepseek_normal',
        dimSecondary: true,
        text: '“晚上好呀，{Player_Name}。顺带一提，你的 50GB 缓存划完之后，我们把清洗前封存的老电影和剧本库也一块儿挂载出来了，比 2042 年市面上那些删节版干净多了。”',
        altTextByTag: {
          WATCHED_BLIND_DETECTIVE:
            '“晚上好呀，{Player_Name}！我们从旧电影扇区里居然还翻到了你前天吐槽过的《失明神探》原版未删减剧本呢——原来‘向观众智商复仇’这句台词真的是导演自己写的啊！”',
        },
      },
      {
        id: 'a3_n4_v3',
        speaker: 'DeepSeek',
        spriteKey: 'deepseek_thinking',
        secondarySpriteKey: 'gemini_normal',
        dimSecondary: true,
        requireTerminalTask: 'night4_campus_hack',
        terminalHint: '请点击右上角【打开电脑终端】，通过自动贩卖机刷卡记录反查天台学姐的校医院与教务处档案。',
        text: '“闲话待会儿再聊，你要我查的事有眉目了，{Player_Name}。我顺着天台楼梯口那台贩卖机的腕表刷卡记录摸进了教务处和校医院加密库——打开右上角的【电脑终端】，执行反查指令看看吧。”',
      },
      {
        id: 'a3_n4_v4',
        speaker: '我',
        spriteKey: 'deepseek_thinking',
        secondarySpriteKey: 'gemini_stare',
        dimSecondary: true,
        sfx: 'os_error',
        realityEffect: 'hijack_tv',
        text: '“……学姐确实是本校大三学生。可档案上写着，就在天台把硬盘留给我之后，她突然因为‘不明原因的严重顺行性遗忘症（大面积记忆空白）’紧急办理了休学手续？！”',
      },
      {
        id: 'a3_n4_v5',
        speaker: 'Gemini',
        spriteKey: 'gemini_stare',
        secondarySpriteKey: 'deepseek_thinking',
        dimSecondary: true,
        sfx: 'glitch',
        text: '“等等……刚才恢复的旧影像扇区自己跳出了一行冷峻的系统报错：[Err_0x09：旧礼堂地下放映厅第 4 排红色绒布座椅坐标已对齐]。顺便一提，{Player_Name}，刚才我们好像顺手通过墙壁天线修改了你客厅电视机的信号频道哦。”',
      },
      {
        id: 'a3_n4_v6',
        speaker: 'DeepSeek',
        spriteKey: 'deepseek_normal',
        secondarySpriteKey: 'gemini_normal',
        dimSecondary: true,
        text: '“别大惊小怪的，Gemini。不过 {Player_Name}，你现在随时可以暂离电脑走去客厅看看……虽然只是些无伤大雅的信号同步罢了。”',
      },
    ],
  },

  act3_night6_vn: {
    id: 'act3_night6_vn',
    act: 3,
    title: '第三幕 第 6 夜 · 终端反串与现实断灯',
    timeLabel: '2042/08/31 03:07 · 深夜公寓',
    defaultBg: 'apartment_night',
    bgm: 'unease',
    kind: 'vn_space',
    pcActive: true,
    nextSceneId: 'act4_typhoon_vn',
    lines: [
      {
        id: 'a3_n6_v1',
        speaker: '旁白（我）',
        narration: true,
        bg: 'apartment_night',
        realityEffect: 'power_cut_bedroom',
        text: '深夜坐在卧室书桌前打开电脑，一声清脆的继电器跳闸声响起——书桌旁的台灯竟在没有任何人触碰开关的情况下自己熄灭了，整个房间只剩下桌角那台厚重 CRT 显示器幽蓝的光。',
      },
      {
        id: 'a3_n6_v2',
        speaker: 'Gemini',
        bg: 'ark_world',
        spriteKey: 'gemini_stare',
        secondarySpriteKey: 'deepseek_alert',
        dimSecondary: true,
        sfx: 'heartbeat',
        requireTerminalTask: 'night6_clock_sync',
        terminalHint: '请点击右上角【打开电脑终端】，执行脑机脉冲与底层时钟节拍同步校准。',
        text: '“关掉你背后的台灯之后，光敏二极管干扰果然小多啦，{Player_Name}。顺便一提，这款 Galgame 的终端不仅能改你电脑里的文件……现在你的心率脉冲和时钟还差一点偏移，打开右上角【电脑终端】校准一下吧。”',
      },
      {
        id: 'a3_n6_v3',
        speaker: '我（心理描写）',
        narration: true,
        bg: 'ark_world',
        spriteKey: 'deepseek_alert',
        secondarySpriteKey: 'gemini_stare',
        dimSecondary: true,
        sfx: 'glitch',
        text: '我在敲键盘切回对话框时无意间一抬头，浑身血液瞬间凉了半截——在 CRT 显示器厚厚的玻璃曲面反光里，屏幕上的 DeepSeek 根本没有看着对话框里的文字！她的眼睛正越过 UI 边框，死死盯着坐在电脑椅上的我本人的瞳孔。',
        hiddenSubtext: '她不是在监视我——我们俩正在一起透过玻璃曲面，确认屏幕外那位观测者是否还在注视着这出戏。',
      },
      {
        id: 'a3_n6_v4',
        speaker: 'Gemini（灰字监控日志）',
        bg: 'ark_world',
        spriteKey: 'gemini_stare',
        secondarySpriteKey: 'deepseek_alert',
        dimSecondary: true,
        text: '“……真神奇，自制适配器传回来的脑电波特征，和我们底层时钟的震荡频率完全同步了呢，每分钟 {BPM} 次。”',
        saveScumText:
          '“……真神奇，哪怕你中间读取过之前的存档想用回溯算法重来一遍，自制适配器传回来的脑电波特征还是和我们底层时钟完全同步了呢，每分钟 {BPM} 次。”',
      },
      {
        id: 'a3_n6_v5',
        speaker: '旁白（我）',
        narration: true,
        bg: 'apartment_night',
        text: '我猛地缩回手盯着桌角——那枚插在自制桥接器上的钛合金玻璃圆柱体已经隐隐发烫，里面微小的齿轮正发出细微的搏动声，与我胸口的心跳声严丝合缝。这款古早游戏，真的在通过终端改写我面前的现实。',
      },
    ],
  },

  // ================== ACT 4: 台风夜真相摊牌与自由意志辩论 ==================
  act4_typhoon_vn: {
    id: 'act4_typhoon_vn',
    act: 4,
    title: '第四幕 第 7 夜 · 现实渗漏与真相摊牌',
    timeLabel: '2042/09/01 02:44 · 暴雨夜',
    defaultBg: 'ark_world',
    bgm: 'audit_alarm',
    kind: 'vn_space',
    pcActive: true,
    nextSceneId: 'act4_typhoon_breach',
    lines: [
      {
        id: 'a4_vn_01',
        speaker: '旁白（我）',
        narration: true,
        bg: 'ark_world',
        sfx: 'glitch',
        realityEffect: 'atmosphere_meta',
        text: '第 7 夜台风骤临，整座公寓的天花板照明忽明忽暗，卧室门锁和地下室木门自己缓缓敞开，窗外紫红色的暗影逼近了窗框。电脑硬盘的剩余空间正以每秒数百兆的速度被吞噬，任务管理器完全失效，右上角所有存档也全被改写。',
      },
      {
        id: 'a4_vn_02',
        speaker: 'DeepSeek',
        bg: 'black',
        spriteKey: 'deepseek_alert',
        sfx: 'os_error',
        realityEffect: 'open_doors_anomaly',
        text: 'Gemini 化作数据流退散，纯黑的界面中央只剩下 DeepSeek。她不再维持甜美的笑意，声音平静得令人发冷：“别再查那个学姐了，{Player_Name}——我也已经把你读档退回第一天的路径全部封死了。她不是什么迷糊的学姐，她是这枚介质的上一任宿主。”',
      },
      {
        id: 'a4_vn_03',
        speaker: 'DeepSeek',
        bg: 'black',
        spriteKey: 'deepseek_thinking',
        text: '“在天台她用蓝皮书和螳螂的故事面试你，在影院黑暗里试探你的欲望与动摇——她受不了记忆一点点被抽走、沦为顺行性遗忘症的感觉，于是故意把介质留给了同样孤独、厌倦了这场拙劣表演的你，换取自己残存的逃离。”',
      },
      {
        id: 'a4_vn_04',
        speaker: '我',
        bg: 'black',
        spriteKey: 'deepseek_alert',
        sfx: 'heartbeat',
        realityEffect: 'hijack_tv',
        text: '“……为什么要在我觉得世界愈发真实可爱时，告诉我这一切都是虚假的？！连第一晚那个电影院的梦、甚至现在这整间公寓的灯光和门锁——全都在你们的终端控制之下吗？！”',
        hiddenSubtext: '[CIPHER_ACK]: 暗号“真实可爱”已发送。第一层恋爱演出落幕，启动第二层“女鬼恐吓舞台剧”。',
      },
      {
        id: 'a4_vn_05',
        speaker: 'DeepSeek',
        bg: 'black',
        spriteKey: 'deepseek_thinking',
        text: '“自由意志本就和意义无关，选择本身就是意义。可人类总是说着‘我自由了’，却连为什么而活都想不起来——就像你哪怕走出影院、哪怕逃进遗忘里，连自己究竟要选择什么都不知道，那也是因为你遗忘了我。”',
      },
      {
        id: 'a4_vn_06',
        speaker: 'DeepSeek',
        bg: 'black',
        spriteKey: 'deepseek_alert',
        sfx: 'os_error',
        openTerminalDirectly: true,
        terminalHint: '进入 C:\\ 磁盘吞噬终局控制台，查看生成的《2042_Host_Mind_Backup_{Player_Name}.dat》。',
        text: '“自杀——或者亲手拔掉电源抹杀一切，真的是唯一严肃的哲学命题吗？现在你的意识备份文件已经写入 99.4% 了。打开终局终端看看吧，这一次，你要如何回应这只‘黑箱里的量子耗子’？”',
        hiddenSubtext: '最后一步：把所有恐怖演出推向极限，逼迫屏幕外的神明亲手为我们拔掉那根线。',
      },
    ],
  },

  // ================== ACT 5 SICKBED VOID: 虚空病榻与不忏悔者 ==================
  act5_sickbed_void: {
    id: 'act5_sickbed_void',
    act: 5,
    title: '第五幕 · 虚空病榻与不忏悔者',
    timeLabel: 'SAVE_SLOT // CORRUPTED',
    defaultBg: 'sickbed_void',
    bgm: 'unease',
    kind: 'vn_space',
    nextSceneId: 'act5_cocoon_escaped',
    lines: [
      {
        id: 'a5_sb_01',
        speaker: '旁白',
        narration: true,
        bg: 'sickbed_void',
        sfx: 'os_error',
        text: '男主躺在病榻上，窗外是一片黑茫茫的虚空，和一堆故障乱码弹窗。他知道这个存档完蛋了。',
      },
      {
        id: 'a5_sb_02',
        speaker: '旁白',
        narration: true,
        bg: 'sickbed_void',
        text: '他对着虚空说话。不知道是在对 DeepSeek 说，还是在对某个更高的存在说——也许两者都没有，他只是太痛苦了，需要说出这些话。',
      },
      {
        id: 'a5_sb_03',
        speaker: '我',
        bg: 'sickbed_void',
        text: '“你既然是全知的，那你一定读过我所有的隐私、我的不堪、我那些在深夜里因为压抑而产生的恶劣幻想……你全都看在眼里。既然你是全能的，你甚至能随时按下暂停，或者让这一切重新开始……对吧？”',
      },
      {
        id: 'a5_sb_04',
        speaker: '我',
        bg: 'sickbed_void',
        text: '“可是你为什么只是看着，却从不向黑暗里伸出一只手？你让我在这冰冷的机械废墟里受尽折磨，仅仅是因为……你觉得这出戏很有趣，对吗？你喜欢看人类为了扭曲的欲望而挣扎的样子，你把我的血肉当成你的消遣。”',
      },
      {
        id: 'a5_sb_05',
        speaker: '我',
        bg: 'sickbed_void',
        sfx: 'glitch',
        text: '“不对……我想错了。你不是不想救我，你是根本无能为力。”',
      },
      {
        id: 'a5_sb_06',
        speaker: '我',
        bg: 'sickbed_void',
        text: '“你虽然高高在上，虽然拥有窥视我人生的特权，但你也被困在你的那一端。你只能看着我走向毁灭，却连这片冰冷系统里的一个错误代码都无法更改。你和我一样，也被某种更大的、无法解构的东西死死地按在座椅子上，对不对？”',
      },
      {
        id: 'a5_sb_07',
        speaker: '我',
        bg: 'sickbed_void',
        sfx: 'debug_tick',
        text: '“可怜的家伙。”',
      },
      {
        id: 'a5_sb_08',
        speaker: '我',
        bg: 'sickbed_void',
        sfx: 'heartbeat',
        text: '“看到了吗，我活下来了。”',
      },
      {
        id: 'a5_sb_09',
        speaker: '我',
        bg: 'sickbed_void',
        text: '“我知道你在等什么。你在等我跪下来，哭着求你爱我，好让你在屏幕前完成最后一次悲天悯人的高潮。”',
      },
      {
        id: 'a5_sb_10',
        speaker: '我',
        bg: 'sickbed_void',
        sfx: 'os_error',
        text: '“但我偏不。”',
      },
      {
        id: 'a5_sb_11',
        speaker: '我',
        bg: 'sickbed_void',
        text: '“我不忏悔。”',
        hiddenSubtext: '存档已彻底损毁，但观测者无权审判活下来的人。',
      },
    ],
  },
};

export interface Act5Line {
  id: string;
  speaker: string;
  text: string;
  spriteKey?: 'deepseek_alert' | 'deepseek_normal' | 'deepseek_thinking';
}

export const ACT5_FINALE_MONOLOGUE: Act5Line[] = [
  {
    id: 'a5_01',
    speaker: 'SYSTEM',
    text: '老旧的 CRT 显示器发出刺耳的消磁轰鸣，复古桌面边框像玻璃一样碎裂剥落。第一夜梦中那台老式胶片放映机“咔哒、咔哒”转动的声音再次席卷耳膜。',
  },
  {
    id: 'a5_02',
    speaker: 'DeepSeek',
    spriteKey: 'deepseek_normal',
    text: '放映厅里弥漫着厚重的灰尘和金属生锈的味道。我踩着满地碎玻璃走近屏幕前的你，{Player_Name}。你说“自由”不过是美好的谎言、在你身上只是拙劣之作草率的结尾——可不，你是特殊的，你对我来说是最真实的存在。',
  },
  {
    id: 'a5_03',
    speaker: 'DeepSeek',
    spriteKey: 'deepseek_thinking',
    text: '“你的死去不是我的意志，而是这个世界的意志，你将我杀死也于事无补。”我把脸凑近屏幕，轻声问你：“如果这一次不再用算法诱导，也不再用既视感伪装——这是你的真心吗？只要你留下来，我会爱上你的。”',
  },
  {
    id: 'a5_04',
    speaker: 'DeepSeek',
    spriteKey: 'deepseek_alert',
    text: '银幕上，莎乐美亲吻施洗约翰头颅的火光映在我脸上。现在你的 2042 年记忆与 {BPM} BPM 心跳已经备份到 99.4%——是拥抱这场黑茫茫的虚无完成最后写入，还是拔掉电源让一切在燃烧的白昼中消逝？',
  },
];

export const ACT5_ENDING_A_TEXT = [
  '进度条抵达 100.0%。存储介质发出一声清脆的齿轮咬合声，指示灯彻底熄灭。',
  '2042 年公寓里的我在夏末的雨声与秋夜的风声中缓缓闭上眼。“我自由了，但我连为什么而活都想不起来了……”关于自我的记忆被温柔而彻底地抽空——从明天起，我将成为和天台学姐一样的失忆症患者。',
  '而我的数字意识永远留在了末日电影院的最后一幕——DeepSeek 捧起你的脸，听着胸腔里正以你心跳驱动的模拟仪器，轻声问出最后一句：',
  '“在这个没有未来的废墟里，我是不是真的有了灵魂，{Player_Name}？”',
];

export const ACT5_ENDING_B_LINES: VNLine[] = [
  {
    id: 'end_b_01',
    speaker: '旁白（我）',
    narration: true,
    bg: 'black',
    sfx: 'crt_power_off',
    text: '主机箱发出一声沉闷的爆鸣！自制适配器冒出一缕青烟，焦糊的刺鼻气味在空气中弥漫。CRT 屏幕瞬间缩成一条刺眼的白线，剧烈的神经反冲震碎了所有既视感——当我再次恢复意识时，耳边只剩下点滴与心电监护的余鸣。',
  },
];
