"""Классы приложения HOME POLICE: WebView-активность и напоминания."""
from dexgen import Asm, build_dex

PKG = 'com.homepolice.game'
ACT = 'L' + PKG.replace('.', '/') + '/MainActivity;'
REM = 'L' + PKG.replace('.', '/') + '/Rem;'
T_ACT, T_CTX, T_BUNDLE, T_VIEW, T_WS, T_WV, T_STR, T_OBJ = ('Landroid/app/Activity;', 'Landroid/content/Context;', 'Landroid/os/Bundle;',
    'Landroid/view/View;', 'Landroid/webkit/WebSettings;', 'Landroid/webkit/WebView;', 'Ljava/lang/String;', 'Ljava/lang/Object;')
T_CS, T_CLS, T_INTENT, T_PI, T_AM, T_NM, T_NCH = ('Ljava/lang/CharSequence;', 'Ljava/lang/Class;', 'Landroid/content/Intent;', 'Landroid/app/PendingIntent;',
    'Landroid/app/AlarmManager;', 'Landroid/app/NotificationManager;', 'Landroid/app/NotificationChannel;')
T_BR, T_NB, T_NOTIF, T_BTS, T_STYLE, T_SYS = ('Landroid/content/BroadcastReceiver;', 'Landroid/app/Notification$Builder;', 'Landroid/app/Notification;',
    'Landroid/app/Notification$BigTextStyle;', 'Landroid/app/Notification$Style;', 'Ljava/lang/System;')
SDK_INT = ('Landroid/os/Build$VERSION;', 'SDK_INT', 'I')
CHR = 'L' + PKG.replace('.', '/') + '/Chrome;'
T_WCC, T_TTS, T_TTSL, T_LOC, T_JPR, T_FLT = ('Landroid/webkit/WebChromeClient;', 'Landroid/speech/tts/TextToSpeech;', 'Landroid/speech/tts/TextToSpeech$OnInitListener;',
    'Ljava/util/Locale;', 'Landroid/webkit/JsPromptResult;', 'Ljava/lang/Float;')
TTSF = (CHR, 'tts', T_TTS)
URL = 'file:///android_asset/index.html'
ICON_NOTIF = 0x7f010001
FIRST_DELAY = 20 * 3600 * 1000      # через 20 часов после выхода из игры
REPEAT_DELAY = 48 * 3600 * 1000     # потом раз в двое суток

MESSAGES = [
    ('📞 Комиссар Громов', 'Где тебя носит? На столе растёт гора папок, а преступники в Туманске уже празднуют. Возвращайся.'),
    ('🧪 Вера Соколова', 'Экспертиза готова. Результат тебя удивит — но рассказывать по телефону не буду. Заходи.'),
    ('💻 Лиза Ким', 'Взломала телефон, который ты оставил. Там такая переписка… Я бы на твоём месте поторопилась.'),
    ('🕯️ Неизвестный номер', 'Похоже, следователь сдался. Отлично. Значит, мне ничего не грозит…'),
    ('🗞️ Вестник Туманска', 'СРОЧНО: в городе снова неспокойно. Полиция молчит. Где лучший следователь?'),
    ('🐕 Марина Орлова', 'Рекс третий день сидит у двери отдела и ждёт тебя. Даже собака понимает: дело не закрыто.'),
    ('🧑‍🤝‍🧑 Игорь Белов', 'Напарник, я один не вывожу. Свидетели путаются, подозреваемые наглеют. Ты где?'),
    ('📁 Архив', 'Нераскрытые дела покрываются пылью. Каждый день без следователя — шанс для того, кто врёт.'),
    ('☕ Дежурная часть', 'Кофе остыл, Громов злится, а у дверей очередь из свидетелей. Самое время вернуться.'),
    ('📞 Комиссар Громов', 'Слышал, ты взял отгул. Шучу. Отгулов у детективов не бывает. Жду в кабинете.'),
    ('🔍 Свидетель', 'Я вспомнил ещё кое-что про тот вечер… Но скажу только вам. Лично.'),
    ('⚖️ Прокуратура', 'Сроки по делу горят. Без вашего обвинительного заключения подозреваемого придётся отпустить.'),
    ('🌫️ Туманск', 'Над городом опустился туман. В такие ночи и совершаются преступления. Дело ждёт.'),
    ('🧪 Вера Соколова', 'На уликах нашлось кое-что, чего не должно было быть. Приходи, покажу.'),
    ('🎖️ Отдел кадров', 'До следующего звания осталось совсем немного. Раскройте ещё одно дело.'),
    ('🕵️ Громов', 'Чутьё подсказывает: один из подозреваемых сейчас заметает следы. Не дай ему успеть.'),
]


def classes():
    W = (ACT, 'w', T_WV)
    m_get_svc = (T_CTX, 'getSystemService', T_OBJ, [T_STR])
    m_pi_br = (T_PI, 'getBroadcast', T_PI, [T_CTX, 'I', T_INTENT, 'I'])
    m_pi_act = (T_PI, 'getActivity', T_PI, [T_CTX, 'I', T_INTENT, 'I'])
    m_intent = (T_INTENT, '<init>', 'V', [T_CTX, T_CLS])
    m_time = (T_SYS, 'currentTimeMillis', 'J', [])
    m_sched = (REM, 'schedule', 'V', [T_CTX, 'J'])
    m_chan = (REM, 'channel', 'V', [T_CTX])
    m_split = (T_STR, 'split', '[' + T_STR, [T_STR])

    # ---- MainActivity
    a_init = Asm().inv_direct((T_ACT, '<init>', 'V', []), [0]).ret_void()
    # onCreate: v0..v2, p0=v3, p1=v4
    oc = Asm()
    oc.inv_super((T_ACT, 'onCreate', 'V', [T_BUNDLE]), [3, 4])
    oc.const4(0, 1).inv_virt((T_ACT, 'requestWindowFeature', 'Z', ['I']), [3, 0])
    oc.new_inst(0, T_WV).inv_direct((T_WV, '<init>', 'V', [T_CTX]), [0, 3])
    oc.inv_virt((T_WV, 'getSettings', T_WS, []), [0]).move_result_obj(1)
    oc.const4(2, 1)
    for n in ('setJavaScriptEnabled', 'setDomStorageEnabled', 'setAllowFileAccess'):
        oc.inv_virt((T_WS, n, 'V', ['Z']), [1, 2])
    oc.const4(2, 0).inv_virt((T_WS, 'setMediaPlaybackRequiresUserGesture', 'V', ['Z']), [1, 2])
    oc.inv_virt((T_WS, 'getUserAgentString', T_STR, []), [1]).move_result_obj(2)
    oc.const_str(4, ' HPTTS/2').inv_virt((T_STR, 'concat', T_STR, [T_STR]), [2, 4]).move_result_obj(2)
    oc.inv_virt((T_WS, 'setUserAgentString', 'V', [T_STR]), [1, 2])
    oc.new_inst(1, CHR).inv_direct((CHR, '<init>', 'V', []), [1])
    oc.new_inst(2, T_TTS).inv_direct((T_TTS, '<init>', 'V', [T_CTX, T_TTSL]), [2, 3, 1])
    oc.iput_obj(2, 1, TTSF)
    oc.inv_virt((T_WV, 'setWebChromeClient', 'V', [T_WCC]), [0, 1])
    oc.const_str(1, URL).inv_virt((T_WV, 'loadUrl', 'V', [T_STR]), [0, 1])
    oc.iput_obj(0, 3, W)
    oc.inv_virt((T_ACT, 'setContentView', 'V', [T_VIEW]), [3, 0])
    oc.inv_static(m_chan, [3])
    oc.ret_void()
    # onBackPressed: v0,v1, p0=v2
    ob = Asm()
    ob.iget_obj(0, 2, W).inv_virt((T_WV, 'canGoBack', 'Z', []), [0]).move_result(1).if_eqz(1, 'sup')
    ob.inv_virt((T_WV, 'goBack', 'V', []), [0]).ret_void()
    ob.label('sup').inv_super((T_ACT, 'onBackPressed', 'V', []), [2]).ret_void()
    # onStop: v0,v1 (wide), p0=v2
    os_ = Asm()
    os_.inv_super((T_ACT, 'onStop', 'V', []), [2])
    os_.const_wide32(0, FIRST_DELAY).inv_static(m_sched, [2, 0, 1]).ret_void()

    main = {'name': ACT, 'super': T_ACT, 'access': 0x1, 'fields': [('w', T_WV, 0x2)], 'methods': [
        {'name': '<init>', 'ret': 'V', 'params': [], 'access': 0x10001, 'regs': 1, 'ins': 1, 'outs': 1, 'code': a_init},
        {'name': 'onCreate', 'ret': 'V', 'params': [T_BUNDLE], 'access': 0x1, 'regs': 5, 'ins': 2, 'outs': 3, 'code': oc},
        {'name': 'onBackPressed', 'ret': 'V', 'params': [], 'access': 0x1, 'regs': 3, 'ins': 1, 'outs': 1, 'code': ob},
        {'name': 'onStop', 'ret': 'V', 'params': [], 'access': 0x1, 'regs': 3, 'ins': 1, 'outs': 3, 'code': os_},
    ]}

    # ---- Rem (BroadcastReceiver)
    r_init = Asm().inv_direct((T_BR, '<init>', 'V', []), [0]).ret_void()
    # channel(Context): v0..v3, p0=v4
    ch = Asm()
    ch.sget(0, SDK_INT).const16(1, 26).if_lt(0, 1, 'end')
    ch.new_inst(0, T_NCH).const_str(1, 'hp').const_str(2, 'Напоминания').const4(3, 3)
    ch.inv_direct((T_NCH, '<init>', 'V', [T_STR, T_CS, 'I']), [0, 1, 2, 3])
    ch.const_str(1, 'notification').inv_virt(m_get_svc, [4, 1]).move_result_obj(1).check_cast(1, T_NM)
    ch.inv_virt((T_NM, 'createNotificationChannel', 'V', [T_NCH]), [1, 0])
    ch.label('end').ret_void()
    # schedule(Context, long): v0..v5, p0=v6, p1-p2=v7,v8
    sc = Asm()
    sc.new_inst(0, T_INTENT).const_class(1, REM).inv_direct(m_intent, [0, 6, 1])
    sc.const4(1, 0).const(5, 0x08000000).inv_static(m_pi_br, [6, 1, 0, 5]).move_result_obj(2)
    sc.const_str(1, 'alarm').inv_virt(m_get_svc, [6, 1]).move_result_obj(1).check_cast(1, T_AM)
    sc.inv_static(m_time, []).move_result_wide(3).add_long2(3, 7)
    sc.const4(5, 1).inv_virt((T_AM, 'set', 'V', ['I', 'J', T_PI]), [1, 5, 3, 4, 2])
    sc.ret_void()
    # onReceive(Context, Intent): v0..v5, p0=v6 this, p1=v7 ctx, p2=v8 intent
    ALL = '|'.join(t + '~' + x for t, x in MESSAGES)
    rv = Asm()
    rv.const_str(0, ALL).const_str(1, '\\|').inv_virt(m_split, [0, 1]).move_result_obj(0)
    rv.inv_static(m_time, []).move_result_wide(1)
    rv.const_wide32(3, 3600000).div_long2(1, 3)
    rv.array_length(3, 0).int_to_long(3, 3).rem_long2(1, 3).long_to_int(1, 1)
    rv.aget_obj(0, 0, 1)
    rv.const_str(1, '~').inv_virt(m_split, [0, 1]).move_result_obj(0)
    rv.const4(1, 0).aget_obj(1, 0, 1).const4(2, 1).aget_obj(2, 0, 2)
    rv.inv_static(m_chan, [7])
    rv.sget(3, SDK_INT).const16(4, 26)
    rv.new_inst(0, T_NB).if_lt(3, 4, 'old')
    rv.const_str(3, 'hp').inv_direct((T_NB, '<init>', 'V', [T_CTX, T_STR]), [0, 7, 3]).goto('built')
    rv.label('old').inv_direct((T_NB, '<init>', 'V', [T_CTX]), [0, 7])
    rv.label('built')
    rv.const(3, ICON_NOTIF).inv_virt((T_NB, 'setSmallIcon', T_NB, ['I']), [0, 3])
    rv.inv_virt((T_NB, 'setContentTitle', T_NB, [T_CS]), [0, 1])
    rv.inv_virt((T_NB, 'setContentText', T_NB, [T_CS]), [0, 2])
    rv.new_inst(3, T_BTS).inv_direct((T_BTS, '<init>', 'V', []), [3])
    rv.inv_virt((T_BTS, 'bigText', T_BTS, [T_CS]), [3, 2])
    rv.inv_virt((T_NB, 'setStyle', T_NB, [T_STYLE]), [0, 3])
    rv.const4(3, 1).inv_virt((T_NB, 'setAutoCancel', T_NB, ['Z']), [0, 3])
    rv.new_inst(3, T_INTENT).const_class(4, ACT).inv_direct(m_intent, [3, 7, 4])
    rv.const4(4, 0).const(5, 0x08000000).inv_static(m_pi_act, [7, 4, 3, 5]).move_result_obj(3)
    rv.inv_virt((T_NB, 'setContentIntent', T_NB, [T_PI]), [0, 3])
    rv.inv_virt((T_NB, 'build', T_NOTIF, []), [0]).move_result_obj(0)
    rv.const_str(3, 'notification').inv_virt(m_get_svc, [7, 3]).move_result_obj(3).check_cast(3, T_NM)
    rv.const4(4, 1).inv_virt((T_NM, 'notify', 'V', ['I', T_NOTIF]), [3, 4, 0])
    rv.const_wide32(4, REPEAT_DELAY).inv_static(m_sched, [7, 4, 5])
    rv.ret_void()

    rem = {'name': REM, 'super': T_BR, 'access': 0x1, 'methods': [
        {'name': '<init>', 'ret': 'V', 'params': [], 'access': 0x10001, 'regs': 1, 'ins': 1, 'outs': 1, 'code': r_init},
        {'name': 'channel', 'ret': 'V', 'params': [T_CTX], 'access': 0x9, 'regs': 5, 'ins': 1, 'outs': 4, 'code': ch},
        {'name': 'schedule', 'ret': 'V', 'params': [T_CTX, 'J'], 'access': 0x9, 'regs': 9, 'ins': 3, 'outs': 5, 'code': sc},
        {'name': 'onReceive', 'ret': 'V', 'params': [T_CTX, T_INTENT], 'access': 0x1, 'regs': 9, 'ins': 3, 'outs': 4, 'code': rv},
    ]}
    # ---- Chrome: WebChromeClient + озвучка через prompt('hptts:…')
    c_init = Asm().inv_direct((T_WCC, '<init>', 'V', []), [0]).ret_void()
    # onInit(int): v0..v3, p0=v4, p1=v5
    oi = Asm()
    oi.iget_obj(0, 4, TTSF).if_eqz(0, 'r')
    oi.new_inst(1, T_LOC).const_str(2, 'ru').const_str(3, 'RU').inv_direct((T_LOC, '<init>', 'V', [T_STR, T_STR]), [1, 2, 3])
    oi.inv_virt((T_TTS, 'setLanguage', 'I', [T_LOC]), [0, 1])
    oi.label('r').ret_void()
    # onJsPrompt(WebView, url, msg, def, JsPromptResult): v0..v7, p0=v8 this, p3=v11 msg, p4=v12 text, p5=v13 result
    T_SET, T_IT, T_VOICE, T_SB = 'Ljava/util/Set;', 'Ljava/util/Iterator;', 'Landroid/speech/tts/Voice;', 'Ljava/lang/StringBuilder;'
    m_eq = (T_STR, 'equals', 'Z', [T_OBJ])
    m_gv = (T_TTS, 'getVoices', T_SET, [])
    m_iter = (T_SET, 'iterator', T_IT, [])
    m_has = (T_IT, 'hasNext', 'Z', [])
    m_next = (T_IT, 'next', T_OBJ, [])
    m_vname = (T_VOICE, 'getName', T_STR, [])
    sbs = (T_SB, 'append', T_SB, [T_STR])
    jp = Asm()
    jp.if_eqz(11, 'no')
    jp.const_str(0, 'hptts').inv_virt((T_STR, 'startsWith', 'Z', [T_STR]), [11, 0]).move_result(0).if_eqz(0, 'no')
    jp.iget_obj(1, 8, TTSF).if_eqz(1, 'done')
    jp.const_str(0, 'hptts-stop').inv_virt(m_eq, [11, 0]).move_result(0).if_eqz(0, 'chkv')
    jp.inv_virt((T_TTS, 'stop', 'I', []), [1]).goto16('done')
    jp.label('chkv')
    jp.const_str(0, 'hptts-voices').inv_virt(m_eq, [11, 0]).move_result(0).if_eqz(0, 'speak')
    jp.inv_virt(m_gv, [1]).move_result_obj(2).if_eqz(2, 'done')
    jp.new_inst(3, T_SB).inv_direct((T_SB, '<init>', 'V', []), [3])
    jp.inv_iface(m_iter, [2]).move_result_obj(2)
    jp.label('loop')
    jp.inv_iface(m_has, [2]).move_result(0).if_eqz(0, 'vend')
    jp.inv_iface(m_next, [2]).move_result_obj(4).check_cast(4, T_VOICE)
    jp.inv_virt((T_VOICE, 'getLocale', T_LOC, []), [4]).move_result_obj(5)
    jp.inv_virt((T_LOC, 'getLanguage', T_STR, []), [5]).move_result_obj(5)
    jp.const_str(6, 'ru').inv_virt(m_eq, [6, 5]).move_result(0).if_eqz(0, 'loop')
    jp.inv_virt(m_vname, [4]).move_result_obj(5).inv_virt(sbs, [3, 5])
    jp.const_str(5, '~').inv_virt(sbs, [3, 5])
    jp.inv_virt((T_VOICE, 'getQuality', 'I', []), [4]).move_result(5).inv_virt((T_SB, 'append', T_SB, ['I']), [3, 5])
    jp.const_str(5, '~').inv_virt(sbs, [3, 5])
    jp.inv_virt((T_VOICE, 'isNetworkConnectionRequired', 'Z', []), [4]).move_result(5).inv_virt((T_SB, 'append', T_SB, ['Z']), [3, 5])
    jp.const_str(5, '|').inv_virt(sbs, [3, 5])
    jp.goto16('loop')
    jp.label('vend')
    jp.inv_virt((T_SB, 'toString', T_STR, []), [3]).move_result_obj(0)
    jp.inv_virt((T_JPR, 'confirm', 'V', [T_STR]), [13, 0]).const4(0, 1).ret(0)
    jp.label('speak')
    jp.const4(0, 6).inv_virt((T_STR, 'substring', T_STR, ['I']), [11, 0]).move_result_obj(2)
    jp.const_str(0, ':').inv_virt((T_STR, 'indexOf', 'I', [T_STR]), [2, 0]).move_result(3)
    jp.if_lez(3, 'nopick')
    jp.add_lit8(4, 3, 1).inv_virt((T_STR, 'substring', T_STR, ['I']), [2, 4]).move_result_obj(5)
    jp.const4(4, 0).inv_virt((T_STR, 'substring', T_STR, ['I', 'I']), [2, 4, 3]).move_result_obj(2)
    jp.inv_virt(m_gv, [1]).move_result_obj(6).if_eqz(6, 'nopick')
    jp.inv_iface(m_iter, [6]).move_result_obj(6)
    jp.label('floop')
    jp.inv_iface(m_has, [6]).move_result(0).if_eqz(0, 'nopick')
    jp.inv_iface(m_next, [6]).move_result_obj(4).check_cast(4, T_VOICE)
    jp.inv_virt(m_vname, [4]).move_result_obj(7)
    jp.inv_virt(m_eq, [7, 5]).move_result(0).if_eqz(0, 'floop')
    jp.inv_virt((T_TTS, 'setVoice', 'I', [T_VOICE]), [1, 4])
    jp.label('nopick')
    jp.inv_static((T_FLT, 'parseFloat', 'F', [T_STR]), [2]).move_result(0)
    jp.inv_virt((T_TTS, 'setPitch', 'I', ['F']), [1, 0])
    jp.const4(0, 1).const4(2, 0).const4(3, 0)
    jp.inv_virt((T_TTS, 'speak', 'I', [T_CS, 'I', T_BUNDLE, T_STR]), [1, 12, 0, 2, 3]).move_result(0)
    jp.inv_static((T_STR, 'valueOf', T_STR, ['I']), [0]).move_result_obj(0)
    jp.inv_virt((T_JPR, 'confirm', 'V', [T_STR]), [13, 0]).const4(0, 1).ret(0)
    jp.label('done').inv_virt((T_JPR, 'confirm', 'V', []), [13]).const4(0, 1).ret(0)
    jp.label('no').const4(0, 0).ret(0)
    chrome = {'name': CHR, 'super': T_WCC, 'access': 0x1, 'interfaces': [T_TTSL], 'fields': [('tts', T_TTS, 0x1)], 'methods': [
        {'name': '<init>', 'ret': 'V', 'params': [], 'access': 0x10001, 'regs': 1, 'ins': 1, 'outs': 1, 'code': c_init},
        {'name': 'onInit', 'ret': 'V', 'params': ['I'], 'access': 0x1, 'regs': 6, 'ins': 2, 'outs': 3, 'code': oi},
        {'name': 'onJsPrompt', 'ret': 'Z', 'params': [T_WV, T_STR, T_STR, T_STR, T_JPR], 'access': 0x1, 'regs': 14, 'ins': 6, 'outs': 5, 'code': jp},
    ]}
    return [main, rem, chrome]


def build():
    return build_dex(classes())
