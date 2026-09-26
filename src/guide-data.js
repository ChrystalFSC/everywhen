/* ================= Guide data: cities, ranked places and food, things to skip =================
   tier: 3 = Top pick, 2 = Worth it, 1 = If you have time. Rankings are editorial, not live ratings.
   when: morning | afternoon | evening | any | half | full   zone: rough area, used to group a day's stops
   wiki: English Wikipedia article whose lead photo (free licence only) is used as the card photo. */
const CITIES = {
  sh:  { n:'Shanghai', l:'上海', lang:'zh', kind:'base' },
  sz:  { n:'Suzhou', l:'苏州', lang:'zh', kind:'daytrip', train:'High-speed train from Shanghai Station or Shanghai Hongqiao to Suzhou Station, about 25–35 min.', leave:'Leave by about 08:30 to beat the garden crowds.', hrs:2.5 },
  hz:  { n:'Hangzhou', l:'杭州', lang:'zh', kind:'daytrip', train:'High-speed train from Shanghai Hongqiao to Hangzhou East, about 1 hour.', leave:'Leave by about 08:00 so you have a full day at West Lake.', hrs:3 },
  han: { n:'Hanoi', l:'Hà Nội', lang:'vi', kind:'transit' },
  sgn: { n:'Ho Chi Minh City', l:'TP. Hồ Chí Minh', lang:'vi', kind:'transit' },
  kul: { n:'Kuala Lumpur', l:'Kuala Lumpur', lang:'en', kind:'home' }
};
const CTX = {
  sh: 'You have <b>6 nights</b> in Shanghai, from 14:15 on Thu 18 Feb to 15:25 on Wed 24 Feb. Sat 20 Feb is the <b>Lantern Festival</b>. Six days is more than Shanghai needs, so consider a day trip to <b>Suzhou</b> or <b>Hangzhou</b>.',
  sz: '<b>Suzhou</b> is a 30-minute bullet train from Shanghai. It is famous for classical gardens and canal streets, and one full day is enough. Go on a weekday for calmer gardens.',
  hz: '<b>Hangzhou</b> is about an hour from Shanghai Hongqiao by bullet train. West Lake, temples in the hills and tea villages fill one long day comfortably.',
  han: 'You have <b>one evening and one morning</b> in Hanoi. You land at 18:05 on Wed 24 Feb and need to be back at Noi Bai by 12:20 on Thu 25 Feb. Allow about an hour each way to the Old Quarter.',
  sgn: 'This is a <b>short night</b>. You land at 21:00 on Wed 17 Feb and need to be back at Tan Son Nhat by 06:50. Sleep close to the airport, or go out for a late bite if you still have energy.'
};
const INTERESTS = [['history','History & culture'],['views','Views & skyline'],['nature','Gardens & nature'],['food','Food'],['shopping','Shopping'],['night','Nightlife']];
const G = (id, c, k, tier, n, l, o) => ({ id: k === 'food' ? 'f-' + id : id, c, k, tier, n, l, hrs: k === 'food' ? .75 : 1.5, when:'any', zone:'', tags:[], tip:'', ...o });
const ITEMS = [
  /* ---- Shanghai ---- */
  G('bund','sh','place',3,'The Bund','外滩',{ aka:['waitan', 'the bund', '外滩观光'], zone:'bund', hrs:1.5, when:'evening', tags:['views','history'], wiki:'The_Bund', why:'The defining view of Shanghai, free and open all night.', how:'Line 2 or 10 · East Nanjing Rd', d:'The colonial-era riverfront facing the Pudong skyline. Walk the promenade when both banks are lit up.', tip:'The building lights usually switch off around 22:00.' }),
  G('lujiazui','sh','place',3,'Shanghai Tower observation deck','上海中心大厦',{ aka:['shanghai tower', '上海中心', 'lujiazui', '陆家嘴', 'shanghai center'], zone:'pudong', hrs:1.5, when:'afternoon', indoor:true, tags:['views'], wiki:'Lujiazui', why:'The highest deck in China and the best skyline view in the city.', how:'Line 2 or 14 · Lujiazui', d:'The deck on the 118th floor of China’s tallest building. Arrive before sunset to see the city by day and by night.', tip:'Low cloud is common in February. Check the top of the tower from the street before you buy a ticket.' }),
  G('yuyuan','sh','place',3,'Yu Garden & City God Temple','豫园',{ aka:['yuyuan', 'yu yuan', 'city god temple', 'chenghuangmiao', '城隍庙', 'yuyuan bazaar'], zone:'oldcity', hrs:2.5, when:'morning', tags:['history','shopping'], wiki:'Yu_Garden', why:'A Ming-dynasty garden and old-town lanes, and the heart of Lantern Festival celebrations.', how:'Line 10 or 14 · Yuyuan Garden', d:'Rockeries, ponds and pavilions wrapped in a busy bazaar of snack stalls and teahouses.', tip:'The Chinese New Year lantern display usually runs until the Lantern Festival on 20 Feb. Go early to beat the crowds.' }),
  G('wukang','sh','place',3,'Wukang Road & the Former French Concession','武康路',{ aka:['wukang road', 'wukang lu', 'wukang mansion', '武康大楼', 'french concession', '法租界', 'anfu road'], zone:'french', hrs:2.5, when:'afternoon', tags:['history','shopping'], wiki:'Wukang_Mansion', why:'Shanghai’s most beautiful streets to wander, with cafés on every corner.', how:'Line 10 or 11 · Jiaotong University', d:'Plane-tree streets of 1920s villas, small cafés and the wedge-shaped Wukang Mansion.' }),
  G('museum','sh','place',2,'Shanghai Museum','上海博物馆',{ aka:['shanghai museum', 'shanghai bowuguan'], zone:'center', hrs:2.5, when:'morning', indoor:true, tags:['history'], wiki:'Shanghai_Museum', why:'One of China’s great collections, and a perfect rainy-day plan.', how:'Line 1, 2 or 8 · People’s Square', d:'Bronzes, ceramics, calligraphy and jade across several floors.', tip:'Entry is free but often needs an online reservation. Many Chinese museums close on Mondays.' }),
  G('zjj','sh','place',2,'Zhujiajiao water town','朱家角',{ aka:['zhujiajiao', 'zhujiajiao ancient town'], zone:'outer', hrs:5, when:'half', tags:['history','nature'], wiki:'Zhujiajiao', why:'The easiest canal town to reach without leaving Shanghai.', how:'Line 17 · Zhujiajiao, about 1 hour from the centre', d:'Stone bridges, boats and old shopfronts along the canals.', tip:'Weekdays are much quieter than weekends.' }),
  G('nanjing','sh','place',2,'Nanjing Road Pedestrian Street','南京路步行街',{ aka:['nanjing road', 'nanjing lu', '南京路', 'nanjing east road', '南京东路'], zone:'bund', hrs:1.5, when:'evening', tags:['shopping','night'], wiki:'Nanjing_Road', why:'Neon and crowds on the way to the Bund.', how:'Line 1, 2 or 8 · People’s Square', d:'A shopping street running from People’s Square down to the Bund.', tip:'This is where the tea-house scam happens. Ignore friendly strangers who invite you for tea.' }),
  G('cruise','sh','place',2,'Huangpu River night cruise','黄浦江游船',{ aka:['huangpu river', 'river cruise', '黄浦江', 'huangpu cruise'], zone:'bund', hrs:1, when:'evening', tags:['views','night'], wiki:'Huangpu_River', why:'Both skylines at once, from the water.', how:'Piers along the Bund', d:'An hour on the river past the lit-up Bund and the Lujiazui towers.', tip:'Buy tickets at the pier or on Trip.com.' }),
  G('tzf','sh','place',2,'Tianzifang','田子坊',{ aka:['tianzifang', 'taikang road', '泰康路'], zone:'french', hrs:1.5, when:'afternoon', tags:['shopping','history'], wiki:'Tianzifang', why:'Alley houses full of small shops, fun for an hour.', how:'Line 9 · Dapuqiao', d:'A maze of shikumen alley houses turned into craft shops, bars and cafés.', tip:'It gets very crowded in the afternoon.' }),
  G('xtd','sh','place',2,'Xintiandi','新天地',{ aka:['xintiandi', 'xin tian di'], zone:'french', hrs:1.5, when:'evening', tags:['food','night'], wiki:'Xintiandi', why:'Polished stone-gate lanes, good for dinner and drinks.', how:'Line 10 or 13 · Xintiandi', d:'Restored stone-gate houses, now full of restaurants and bars.' }),
  G('jingan','sh','place',1,'Jing’an Temple','静安寺',{ aka:['jingan temple', 'jing an temple', 'jingan si'], zone:'center', hrs:1, when:'any', tags:['history'], wiki:'Jing%27an_Temple', why:'A striking golden temple, quick to see.', how:'Line 2, 7 or 14 · Jing’an Temple', d:'A gilded Buddhist temple among the malls of West Nanjing Road.' }),
  G('qibao','sh','place',1,'Qibao Old Town','七宝古镇',{ aka:['qibao', 'qibao ancient town'], zone:'outer', hrs:2, when:'afternoon', tags:['history','food'], wiki:'Qibao', why:'A mini water town with a snack street, closer than Zhujiajiao.', how:'Line 9 · Qibao', d:'A small old town inside the city with a canal and street food.' }),
  G('disney','sh','place',1,'Shanghai Disneyland','上海迪士尼乐园',{ aka:['disneyland', 'disney', 'shanghai disney', '迪士尼'], zone:'far', hrs:9, when:'full', tags:[], wiki:'Shanghai_Disneyland', why:'Only if theme parks are your thing. It takes a full day.', how:'Line 11 · Disney Resort', d:'A full day out. Buy tickets ahead, especially in the holiday season.' }),
  G('xlb','sh','food',3,'Xiaolongbao','小笼包',{ aka:['xiao long bao', 'soup dumplings', 'xlb'], when:'any', tags:['food'], wiki:'Xiaolongbao', why:'Shanghai’s signature dish.', d:'Soup dumplings: thin pork dumplings filled with hot broth. Bite a small hole and sip the soup first.', where:'Jia Jia Tang Bao (佳家汤包), Nanxiang Mantou Dian (南翔馒头店) at Yu Garden, or Din Tai Fung' }),
  G('sjb','sh','food',3,'Shengjianbao','生煎包',{ aka:['sheng jian bao', 'shengjian', 'pan fried buns'], when:'morning', tags:['food'], wiki:'Shengjian_mantou', why:'The crispy-bottomed breakfast locals queue for.', d:'Pan-fried pork buns with a crisp base and a juicy filling.', where:'Yang’s Dumplings (小杨生煎), a chain with branches all over the city' }),
  G('noodle','sh','food',2,'Scallion oil noodles','葱油拌面',{ when:'any', tags:['food'], why:'Cheap, fast and very Shanghai.', d:'Noodles tossed in soy sauce and slow-fried scallion oil.', where:'Most small noodle shops' }),
  G('hongshao','sh','food',2,'Red-braised pork','红烧肉',{ aka:['hong shao rou', 'braised pork'], when:'evening', tags:['food'], wiki:'Red_braised_pork_belly', why:'The classic Shanghainese home dish.', d:'Pork belly braised in soy sauce and sugar until glossy.', where:'Restaurants serving 本帮菜 (Shanghai cuisine)' }),
  G('wonton','sh','food',2,'Small wontons in broth','小馄饨',{ when:'morning', tags:['food'], wiki:'Wonton', why:'Warming on a cold February morning.', d:'Tiny, silky wontons in a light broth with seaweed and dried shrimp.', where:'Breakfast stalls and noodle shops' }),
  G('tangyuan','sh','food',2,'Tangyuan','汤圆',{ when:'evening', tags:['food'], wiki:'Tangyuan_(food)', why:'The dish of the Lantern Festival on 20 Feb.', d:'Sweet glutinous rice balls in warm syrup.', where:'Dessert shops around Yu Garden' }),
  G('lanzhou','sh','food',2,'Lanzhou beef noodles','兰州牛肉面',{ when:'any', tags:['food'], wiki:'Lanzhou_beef_noodle_soup', why:'A dependable halal meal on almost every street.', d:'Hand-pulled noodles in clear beef broth, usually run by Hui Muslim families.', where:'Look for the green 清真 (halal) sign.' }),
  G('cifan','sh','food',1,'Sticky rice roll','粢饭团',{ when:'morning', tags:['food'], wiki:'Cifantuan', why:'A quick breakfast on the go.', d:'Glutinous rice wrapped around a crunchy fried dough stick.', where:'Street breakfast stalls, early morning' }),

  /* ---- Suzhou (day trip) ---- */
  G('zzy','sz','place',3,'Humble Administrator’s Garden','拙政园',{ aka:['humble administrator', 'zhuozhengyuan', 'zhuozheng garden'], zone:'north', hrs:2, when:'morning', tags:['nature','history'], wiki:'Humble_Administrator%27s_Garden', why:'The finest classical garden in China and a UNESCO World Heritage site.', how:'Suzhou Metro Line 4 · Beisita, or 15 min by DiDi from the station', d:'Ponds, pavilions and winding walkways designed as a landscape painting you can walk through.', tip:'Book ahead online with your passport and arrive at opening time, before the tour groups.' }),
  G('pingjiang','sz','place',3,'Pingjiang Road','平江路',{ aka:['pingjiang lu', 'pingjiang street'], zone:'north', hrs:1.5, when:'afternoon', tags:['history','food','shopping'], wiki:'Pingjiang_Road', why:'Suzhou’s prettiest canal street, and free.', how:'Suzhou Metro Line 1 · Xiangmen, or walk from the gardens', d:'A stone-paved street along a canal lined with teahouses, snack shops and small museums.' }),
  G('szmuseum','sz','place',2,'Suzhou Museum','苏州博物馆',{ aka:['suzhou museum', '苏博'], zone:'north', hrs:1.5, when:'morning', indoor:true, tags:['history'], wiki:'Suzhou_Museum', why:'I. M. Pei’s modern take on a Suzhou garden, next to the Humble Administrator’s Garden.', how:'Next door to the Humble Administrator’s Garden', d:'Galleries of paintings, ceramics and crafts in a striking white-and-grey building.', tip:'Reserve free tickets ahead, and check opening days before you go.' }),
  G('lingering','sz','place',2,'Lingering Garden','留园',{ aka:['liuyuan', 'liu yuan'], zone:'west', hrs:1.5, when:'any', tags:['nature','history'], wiki:'Lingering_Garden', why:'Often quieter than the Humble Administrator’s Garden, with superb rock sculptures.', how:'About 15 min by DiDi from Pingjiang Road', d:'Courtyards and corridors framing views of rockeries, ponds and old trees.' }),
  G('tigerhill','sz','place',2,'Tiger Hill','虎丘',{ aka:['huqiu', 'tiger hill pagoda', '虎丘塔'], zone:'west', hrs:2, when:'any', tags:['history','nature'], wiki:'Tiger_Hill_Pagoda', why:'A leaning thousand-year-old pagoda on a wooded hill.', how:'About 20 min by DiDi from the centre', d:'A hill park with a leaning pagoda, ponds and stone paths.' }),
  G('shantang','sz','place',2,'Shantang Street','山塘街',{ aka:['shantang jie', 'shantang'], zone:'west', hrs:1.5, when:'evening', tags:['night','food','history'], wiki:'Shantang_Street', why:'Lantern-lit canal street, best just after dark.', how:'Suzhou Metro Line 2 · Shantang Street', d:'An old canal street with red lanterns, snacks and boat rides.' }),
  G('squirrel','sz','food',3,'Squirrel-shaped mandarin fish','松鼠桂鱼',{ when:'evening', tags:['food'], why:'Suzhou’s showpiece dish.', d:'A whole fish scored, fried crisp so it fans out, and glazed in sweet-and-sour sauce.', where:'Established Suzhou restaurants such as Songhelou (松鹤楼)' }),
  G('sznoodle','sz','food',2,'Suzhou-style noodles','苏式汤面',{ when:'morning', tags:['food'], why:'The local breakfast: fine noodles in a rich clear broth.', d:'Thin noodles in a dark, fragrant broth with toppings such as braised pork or shrimp.', where:'Small noodle shops around Pingjiang Road' }),
  G('biluochun','sz','food',2,'Biluochun green tea','碧螺春',{ when:'afternoon', tags:['food'], wiki:'Biluochun', why:'One of China’s most famous teas, grown near Suzhou.', d:'A delicate, fruity green tea, best at a canal-side teahouse.', where:'Teahouses on Pingjiang Road' }),

  /* ---- Hangzhou (day trip) ---- */
  G('westlake','hz','place',3,'West Lake','西湖',{ aka:['xihu', 'west lake hangzhou', 'hangzhou west lake', 'su causeway', '苏堤'], zone:'lake', hrs:3, when:'any', tags:['nature','views','history'], wiki:'West_Lake', why:'One of China’s most celebrated landscapes and a UNESCO World Heritage site.', how:'Hangzhou Metro Line 1 · Longxiangqiao', d:'Walk the Su Causeway (苏堤), past willows and bridges, or take a boat to the islands.', tip:'Buy boat tickets from the official booths. Weekends and holidays are extremely crowded.' }),
  G('lingyin','hz','place',3,'Lingyin Temple & Feilai Feng','灵隐寺',{ aka:['lingyin si', 'lingyin', 'feilai feng', '飞来峰'], zone:'hills', hrs:2.5, when:'morning', tags:['history'], wiki:'Lingyin_Temple', why:'One of China’s largest and oldest Buddhist temples, with carvings in the cliffs.', how:'About 20 min by DiDi from West Lake', d:'Grand halls in a forested valley, next to hundreds of Buddhist rock carvings.' }),
  G('longjing','hz','place',2,'Longjing tea village','龙井村',{ aka:['dragon well', 'longjing village', 'longjing cun', '龙井'], zone:'hills', hrs:2, when:'afternoon', tags:['nature','food'], wiki:'Longjing_tea', why:'Terraced tea hills and a cup of Dragon Well tea where it grows.', how:'About 20 min by DiDi from West Lake', d:'A village surrounded by tea terraces, with farmhouses serving fresh tea.', tip:'Agree the price of tea before you sit down.' }),
  G('leifeng','hz','place',2,'Leifeng Pagoda','雷峰塔',{ aka:['leifeng ta'], zone:'lake', hrs:1, when:'evening', indoor:true, tags:['views','history'], wiki:'Leifeng_Pagoda', why:'The best viewpoint over West Lake at sunset.', how:'On the south shore of West Lake', d:'A rebuilt pagoda with lifts and a top-floor view over the lake.' }),
  G('hefang','hz','place',1,'Hefang Street','河坊街',{ aka:['hefang jie', 'qinghefang', '清河坊'], zone:'lake', hrs:1.5, when:'evening', tags:['shopping','food'], wiki:'Hefang_Street', why:'Busy old-style street for snacks, but touristy.', how:'Hangzhou Metro Line 1 · Ding’an Road', d:'A restored street of shops, snacks and traditional pharmacies.' }),
  G('dongpo','hz','food',3,'Dongpo pork','东坡肉',{ aka:['dong po rou', 'dongpo rou'], when:'evening', tags:['food'], wiki:'Dongpo_pork', why:'Hangzhou’s most loved dish.', d:'Thick squares of pork belly slow-braised in rice wine and soy until meltingly soft.', where:'Lou Wai Lou (楼外楼) by West Lake, or Grandma’s Kitchen (外婆家)' }),
  G('ljshrimp','hz','food',3,'Longjing shrimp','龙井虾仁',{ when:'any', tags:['food'], why:'Delicate river shrimp stir-fried with Dragon Well tea leaves.', d:'Light, fragrant and a good contrast to rich braised dishes.', where:'Restaurants around West Lake' }),
  G('pianerchuan','hz','food',2,'Pian’er chuan noodles','片儿川',{ when:'morning', tags:['food'], why:'The local noodle breakfast.', d:'Noodles with sliced pork, pickled greens and bamboo shoots.', where:'Noodle shops such as Kui Yuan Guan (奎元馆)' }),

  /* ---- Hanoi (transfer) ---- */
  G('hoankiem','han','place',3,'Hoan Kiem Lake','Hồ Hoàn Kiếm',{ aka:['hoan kiem', 'ho guom', 'turtle lake', 'huc bridge', 'ngoc son'], zone:'oldq', hrs:1, when:'evening', tags:['views','history'], wiki:'Ho%C3%A0n_Ki%E1%BA%BFm_Lake', why:'The heart of Hanoi, beautiful at night.', how:'About 45–60 min from Noi Bai by Grab', d:'Walk the shore and see the red Huc Bridge lit up.' }),
  G('oldq','han','place',3,'Old Quarter streets','Phố cổ Hà Nội',{ aka:['old quarter', '36 streets', 'pho co', 'hanoi old quarter'], zone:'oldq', hrs:1.25, when:'evening', tags:['food','history','night'], wiki:'Old_Quarter,_Hanoi', why:'Street food, plastic stools and motorbikes: Hanoi in one walk.', how:'A short walk from Hoan Kiem Lake', d:'Narrow streets named after the goods once sold on them.', tip:'The weekend night market runs Friday to Sunday only, so it won’t be on during your Wednesday evening.' }),
  G('temple','han','place',3,'Temple of Literature','Văn Miếu – Quốc Tử Giám',{ aka:['van mieu', 'temple of literature', 'quoc tu giam'], zone:'west', hrs:1.5, when:'morning', tags:['history'], wiki:'Temple_of_Literature,_Hanoi', why:'Vietnam’s first university, founded in 1070, and it opens early.', how:'About 15 min by Grab from the Old Quarter', d:'Courtyards, ponds and stone steles honouring scholars.' }),
  G('trainst','han','place',1,'Train Street','Phố đường tàu',{ aka:['train street', 'hanoi train street', 'pho duong tau'], zone:'oldq', hrs:.5, when:'evening', tags:['night'], why:'Cafés beside a working railway line.', how:'Near Hanoi Railway Station', d:'Cafés squeezed right up against the tracks.', tip:'Police sometimes close access for safety. If you’re turned away, move on.' }),
  G('phobo','han','food',3,'Beef phở','Phở bò',{ aka:['pho', 'pho bo', 'phở'], when:'morning', tags:['food'], wiki:'Ph%E1%BB%9F', why:'Hanoi is where phở comes from, and breakfast is the time to eat it.', d:'Beef noodle soup with a clear, delicate broth.', where:'Phở Gia Truyền at 49 Bát Đàn is a well-known Old Quarter spot' }),
  G('buncha','han','food',3,'Bún chả','Bún chả',{ aka:['bun cha'], when:'evening', tags:['food'], wiki:'B%C3%BAn_ch%E1%BA%A3', why:'Hanoi’s signature meal.', d:'Grilled pork patties in a sweet-sour broth with rice noodles and herbs.', where:'Bún chả Hương Liên on Lê Văn Hưu' }),
  G('eggcoffee','han','food',3,'Egg coffee','Cà phê trứng',{ aka:['ca phe trung', 'egg coffee'], when:'any', tags:['food'], wiki:'Egg_coffee', why:'A Hanoi invention you won’t forget.', d:'Strong coffee topped with whipped egg yolk and condensed milk.', where:'Giảng Café in the Old Quarter, which says it invented the drink' }),
  G('chaca','han','food',2,'Turmeric fish','Chả cá',{ when:'evening', tags:['food'], wiki:'Ch%E1%BA%A3_c%C3%A1_L%C3%A3_V%E1%BB%8Dng', why:'Fish fried at your table with dill.', d:'Turmeric-marinated fish with dill and spring onion.', where:'Chả Cá Street in the Old Quarter is named after it' }),

  /* ---- Ho Chi Minh City (transfer) ---- */
  G('nguyenhue','sgn','place',2,'Nguyen Hue Walking Street','Phố đi bộ Nguyễn Huệ',{ aka:['nguyen hue', 'walking street', 'nguyen hue boulevard'], zone:'centre', hrs:1, when:'evening', tags:['views','night'], wiki:'Nguy%E1%BB%85n_Hu%E1%BB%87_Boulevard', why:'The easiest late-evening walk in Saigon.', how:'About 20–30 min from Tan Son Nhat by Grab', d:'A wide pedestrian boulevard with fountains, ending at the lit-up City Hall.' }),
  G('buivien','sgn','place',1,'Bui Vien Street','Phố Tây Bùi Viện',{ aka:['bui vien', 'backpacker street', 'pham ngu lao'], zone:'centre', hrs:1, when:'evening', tags:['night'], why:'Loud and fun, but only if you still have energy after landing.', how:'About 25 min from Tan Son Nhat by Grab', d:'A neon backpacker street that stays busy past midnight.' }),
  G('banhmi','sgn','food',3,'Bánh mì','Bánh mì',{ aka:['banh mi'], when:'evening', tags:['food'], wiki:'B%C3%A1nh_m%C3%AC', why:'The perfect late-night bite after landing.', d:'A crisp baguette with pâté, cold cuts, pickles and herbs.', where:'Street carts everywhere. Bánh Mì Huỳnh Hoa is the famous one.' }),
  G('comtam','sgn','food',2,'Broken rice','Cơm tấm',{ when:'morning', tags:['food'], wiki:'C%C6%A1m_t%E1%BA%A5m', why:'Saigon’s everyday meal.', d:'Broken rice with grilled pork chop, egg and fish sauce.', where:'Street stalls and small eateries' }),
  G('phosgn','sgn','food',2,'Southern phở','Phở',{ when:'morning', tags:['food'], why:'Sweeter than Hanoi’s, with a plate of fresh herbs.', d:'Beef noodle soup with bean sprouts and herbs on the side.', where:'Phở Hòa Pasteur is a long-running favourite' })
];
const BY = Object.fromEntries(ITEMS.map(i => [i.id, i]));

/* Honest warnings: things we do NOT recommend, and what to do instead. */
const SKIPS = {
  sh: [
    { n:'Bund Sightseeing Tunnel', l:'外滩观光隧道', why:'A short, dated light-show ride under the river that many visitors call a tourist trap.', instead:'Cross by Metro Line 2, or take the cheap Jinling Road ferry (金陵东路轮渡) for river views.' },
    { n:'Tea-house invitation scam', l:'', why:'Friendly strangers around Nanjing Road and People’s Square invite you for tea or a drink, then the bill runs to thousands of yuan.', instead:'Politely say no and walk on. Choose your own café.' },
    { n:'Oriental Pearl Tower', l:'东方明珠', why:'Iconic from outside, but dated inside, and its decks are far lower than its neighbours.', instead:'Go up the Shanghai Tower, and photograph the Pearl from the Bund.' },
    { n:'Unofficial taxis at the airport', l:'', why:'Drivers who approach you in Pudong arrivals often overcharge heavily.', instead:'Use the official taxi queue, DiDi, the Maglev or Metro Line 2.' },
    { n:'Souvenir shopping in the Yu Garden bazaar', l:'', why:'Prices for souvenirs and “antiques” are inflated for visitors.', instead:'Enjoy the architecture and snacks; buy gifts elsewhere.' }
  ],
  sz: [
    { n:'Visiting the gardens at the weekend', l:'', why:'The famous gardens are packed on weekends, which spoils the calm they are known for.', instead:'Go on a weekday, right at opening time.' },
    { n:'Zhouzhuang water town', l:'周庄', why:'Pretty, but heavily commercialised, expensive to enter and far from Suzhou city.', instead:'Walk Pingjiang Road for free, or visit Zhujiajiao from Shanghai.' }
  ],
  hz: [
    { n:'West Lake vinegar fish', l:'西湖醋鱼', why:'Hangzhou’s most famous dish, but many visitors find it overly sour and muddy-tasting.', instead:'Order Dongpo pork or Longjing shrimp.' },
    { n:'West Lake on weekends and holidays', l:'', why:'The causeways become shoulder-to-shoulder crowds.', instead:'Go on a weekday and start early in the morning.' },
    { n:'Unofficial boat touts', l:'', why:'Private boats around the lake often quote one price and charge another.', instead:'Buy from the official ticket booths on the shore.' }
  ],
  han: [
    { n:'Photo-for-money street vendors', l:'', why:'Fruit sellers and shoe shiners put their pole on your shoulder for a photo, then demand payment.', instead:'Smile, say “Không, cảm ơn” (no, thank you) and keep walking.' },
    { n:'Unmetered taxis at Noi Bai', l:'', why:'Unofficial drivers at arrivals are a common overcharge.', instead:'Book Grab, or use the official taxi rank.' }
  ],
  sgn: [
    { n:'Using your phone at the roadside', l:'', why:'Snatch thefts from passing motorbikes happen in the city centre.', instead:'Keep your phone and bag on the side away from the road.' },
    { n:'Shopping at Ben Thanh Market', l:'Chợ Bến Thành', why:'Tourist prices are high and the haggling is aggressive.', instead:'Browse for the atmosphere and compare prices before buying anything.' }
  ]
};

const STAYS = {
  sh: [
    { n:'The Bund & East Nanjing Road', best:'A first visit on foot', good:'Walk to the Bund and Nanjing Road. Metro Line 2 runs straight to Pudong Airport and to Hongqiao for day-trip trains.', watch:'Busy and pricier, with crowded streets in the evening.', how:'Lines 2, 10 · East Nanjing Rd' },
    { n:'People’s Square', best:'Getting around by metro', good:'The main metro hub (Lines 1, 2 and 8), usually good value, and one stop from Nanjing Road.', watch:'Less atmosphere at night than the Bund or the French Concession.', how:'Lines 1, 2, 8 · People’s Square' },
    { n:'Jing’an', best:'Comfort, cafés and malls', good:'Polished and central, with plenty of food and Line 2 to both airports.', watch:'Hotels tend to cost more.', how:'Lines 2, 7, 14 · Jing’an Temple' },
    { n:'Former French Concession & Xintiandi', best:'Atmosphere, food and boutique hotels', good:'Leafy streets and the best café and restaurant scene.', watch:'Not on Line 2, so airport and train trips need a change of line.', how:'Lines 1, 10, 13' },
    { n:'Lujiazui, Pudong', best:'Skyline views and big international hotels', good:'Rooms look over the river and the towers. Line 2 goes direct to Pudong Airport.', watch:'Quiet at night, with fewer street-level restaurants.', how:'Lines 2, 14 · Lujiazui' }
  ],
  sz: [
    { n:'Pingjiang Road area', best:'Canal-side atmosphere', good:'Walk to the Humble Administrator’s Garden and the canal streets.', watch:'Small, older buildings. Confirm the place can host foreign guests.', how:'Suzhou Metro Line 1 · Xiangmen' },
    { n:'Near Suzhou Railway Station', best:'Easy arrival and departure', good:'Step off the bullet train and drop your bags.', watch:'Less charming, and a short ride from the sights.', how:'Suzhou Railway Station' }
  ],
  hz: [
    { n:'West Lake (Hubin)', best:'Waking up by the lake', good:'Walk to the lake at sunrise, before the crowds.', watch:'The most expensive area.', how:'Hangzhou Metro Line 1 · Longxiangqiao' },
    { n:'Near Hangzhou East Station', best:'Easy train connections', good:'Convenient for arriving and leaving by bullet train.', watch:'About 30 minutes from West Lake.', how:'Hangzhou East Railway Station' }
  ],
  han: [
    { n:'Old Quarter', best:'Seeing Hanoi in one evening', good:'Walk to Hoan Kiem Lake, street food and egg coffee.', watch:'About 45–60 minutes from Noi Bai, so leave in good time for your flight.', how:'Grab from Noi Bai, about 45–60 min' },
    { n:'Near Noi Bai Airport', best:'Resting before the flight home', good:'Close to the terminal and quiet. Many hotels here run airport shuttles.', watch:'There is little to do nearby.', how:'Shuttle or a short Grab ride' }
  ],
  sgn: [
    { n:'Near Tan Son Nhat (Tân Bình, Phú Nhuận)', best:'The most sleep on a short night', good:'About 10–15 minutes from the airport.', watch:'Mostly residential, with not much to see.', how:'Grab, about 10–15 min' },
    { n:'City centre', best:'A late walk and food after landing', good:'Close to Nguyen Hue and late-night street food.', watch:'About 20–30 minutes each way, and you need to be back at the airport by 06:50.', how:'Grab, about 20–30 min' }
  ]
};
const STAY_TIP = {
  sh: 'Before you book in China, check the listing accepts foreign guests. Some homestays and small guesthouses can’t register foreign passports. Staying near a Line 2 station makes both airports and the day-trip trains simple.',
  sz: 'Most visitors see Suzhou as a day trip from Shanghai. If you stay, check the hotel can register foreign passports.',
  hz: 'Hangzhou works as a long day trip. Staying one night lets you see West Lake at sunrise without the crowds.',
  han: 'Your bags are checked through to Kuala Lumpur, so pack a small overnight bag in your carry-on.',
  sgn: 'Your bags are checked through to Shanghai, so pack a small overnight bag in your carry-on.'
};
