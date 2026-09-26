/* ================= Offline gazetteer for "Can I go to…?" =================
   from: the trip city it is reached from. mins: typical one-way door-to-door time from that city's centre.
   mode: train | metro | bus | car | ferry | flight. hrs: time needed on site. Travel times are typical
   estimates for a visitor using public transport or a hired car. */
const PLACES = [
  { id:'wuzhen', n:'Wuzhen', zh:'乌镇', aka:['wu zhen','xizha','西栅'], wiki:'Wuzhen', type:'town', from:'sh', mins:120, mode:'bus', hrs:6, note:'The Xizha side is at its best after dark, so many people stay one night.' },
  { id:'xitang', n:'Xitang', zh:'西塘', wiki:'Xitang', type:'town', from:'sh', mins:90, mode:'bus', hrs:5, note:'Canal town with long covered walkways. Quieter on weekdays.' },
  { id:'tongli', n:'Tongli', zh:'同里', wiki:'Tongli', type:'town', from:'sh', mins:100, mode:'bus', hrs:5, note:'A smaller, calmer water town near Suzhou.' },
  { id:'nanjing', n:'Nanjing', zh:'南京', wiki:'Nanjing', type:'city', from:'sh', mins:95, mode:'train', hrs:8, note:'Ming city wall, Sun Yat-sen Mausoleum and the Confucius Temple. A long day; one night is more relaxed.' },
  { id:'wuxi', n:'Wuxi', zh:'无锡', wiki:'Wuxi', type:'city', from:'sh', mins:60, mode:'train', hrs:7, note:'Lake Tai and the giant Lingshan Buddha.' },
  { id:'yangzhou', n:'Yangzhou', zh:'扬州', wiki:'Yangzhou', type:'city', from:'sh', mins:150, mode:'train', hrs:7, note:'Slender West Lake and famous morning dim sum.' },
  { id:'ningbo', n:'Ningbo', zh:'宁波', wiki:'Ningbo', type:'city', from:'sh', mins:150, mode:'train', hrs:7, note:'Tianyi Pavilion library and an old port town.' },
  { id:'jiaxing', n:'Jiaxing', zh:'嘉兴', wiki:'Jiaxing', type:'city', from:'sh', mins:45, mode:'train', hrs:5, note:'South Lake and zongzi rice dumplings.' },
  { id:'moganshan', n:'Moganshan', zh:'莫干山', aka:['mogan mountain'], wiki:'Moganshan', type:'mountain', from:'sh', mins:180, mode:'car', hrs:8, note:'Bamboo-covered hills and villa resorts, best with a night there.' },
  { id:'qiandao', n:'Qiandao Lake', zh:'千岛湖', aka:['thousand island lake'], wiki:'Qiandao_Lake', type:'nature', from:'sh', mins:190, mode:'train', hrs:8, note:'A huge lake of forested islands. Needs a night to be worth the trip.' },
  { id:'huangshan', n:'Huangshan (Yellow Mountain)', zh:'黄山', aka:['yellow mountain','huang shan'], wiki:'Huangshan', type:'mountain', from:'sh', mins:280, mode:'train', hrs:10, note:'Needs at least one night, ideally two. Paths can be icy in February.' },
  { id:'putuo', n:'Mount Putuo', zh:'普陀山', aka:['putuoshan','putuo shan'], wiki:'Mount_Putuo', type:'mountain', from:'sh', mins:270, mode:'ferry', hrs:8, note:'Buddhist island reached by bus and ferry. Needs a night.' },
  { id:'sheshan', n:'Sheshan', zh:'佘山', wiki:'Sheshan', type:'nature', from:'sh', mins:60, mode:'metro', hrs:3, note:'Wooded hills with a basilica and observatory, on Metro Line 9.' },
  { id:'scitech', n:'Shanghai Science and Technology Museum', zh:'上海科技馆', aka:['science museum','science and technology museum'], wiki:'Shanghai_Science_and_Technology_Museum', type:'sight', from:'sh', mins:30, mode:'metro', hrs:2.5, indoor:true, note:'Big hands-on museum. A good rainy-day option.' },
  { id:'nathist', n:'Shanghai Natural History Museum', zh:'上海自然博物馆', aka:['natural history museum'], wiki:'Shanghai_Natural_History_Museum', type:'sight', from:'sh', mins:25, mode:'metro', hrs:2, indoor:true, note:'Dinosaurs and a striking spiral building. Reserve ahead.' },
  { id:'longhua', n:'Longhua Temple', zh:'龙华寺', wiki:'Longhua_Temple', type:'sight', from:'sh', mins:30, mode:'metro', hrs:1.5, note:'Shanghai’s largest and oldest temple, with a pagoda.' },
  { id:'psa', n:'Power Station of Art', zh:'上海当代艺术博物馆', aka:['psa'], wiki:'Power_Station_of_Art', type:'sight', from:'sh', mins:30, mode:'metro', hrs:2, indoor:true, note:'Contemporary art in a former power plant by the river.' },
  { id:'m50', n:'M50 Art District', zh:'M50创意园', aka:['m50','moganshan road'], wiki:'M50_(Shanghai)', type:'sight', from:'sh', mins:25, mode:'metro', hrs:1.5, note:'Galleries and studios in old warehouses.' },
  { id:'westbund', n:'West Bund', zh:'西岸', aka:['xuhui riverside'], wiki:'West_Bund', type:'sight', from:'sh', mins:30, mode:'metro', hrs:2, note:'Riverside promenade with art museums.' },
  { id:'beijing', n:'Beijing', zh:'北京', aka:['peking'], wiki:'Beijing', type:'city', from:'sh', mins:330, mode:'train', hrs:24, note:'About 4.5 to 6 hours by bullet train or 2 hours by plane each way. It deserves at least 3 days.' },
  { id:'greatwall', n:'Great Wall of China', zh:'长城', aka:['great wall','badaling','mutianyu','八达岭','慕田峪'], wiki:'Mutianyu', type:'sight', from:'sh', mins:420, mode:'flight', hrs:24, note:'The Great Wall is near Beijing, about 1,100 km from Shanghai.' },
  { id:'xian', n:'Xi’an', zh:'西安', aka:['xian','terracotta warriors','terracotta army','兵马俑'], wiki:'Xi%27an', type:'city', from:'sh', mins:330, mode:'flight', hrs:24, note:'Home of the Terracotta Army, about 1,200 km away. Needs 2 to 3 days.' },
  { id:'hongkong', n:'Hong Kong', zh:'香港', aka:['hk'], wiki:'Hong_Kong', type:'city', from:'sh', mins:330, mode:'flight', hrs:24, note:'A separate border crossing and at least 2.5 hours by air.' },
  { id:'guilin', n:'Guilin', zh:'桂林', aka:['yangshuo','阳朔','li river','漓江'], wiki:'Guilin', type:'city', from:'sh', mins:300, mode:'flight', hrs:24, note:'Karst mountains and the Li River, about 1,300 km away. Needs 2 to 3 days.' },
  { id:'zhangjiajie', n:'Zhangjiajie', zh:'张家界', aka:['avatar mountains'], wiki:'Zhangjiajie_National_Forest_Park', type:'nature', from:'sh', mins:360, mode:'flight', hrs:24, note:'The “Avatar” mountains, over 1,000 km away. Needs 2 to 3 days.' },
  { id:'chengdu', n:'Chengdu', zh:'成都', aka:['pandas','panda base','大熊猫'], wiki:'Chengdu', type:'city', from:'sh', mins:330, mode:'flight', hrs:24, note:'Giant pandas and Sichuan food, about 1,700 km away.' },
  { id:'halong', n:'Ha Long Bay', zh:'下龙湾', aka:['halong','ha long','vịnh hạ long','vinh ha long'], wiki:'H%E1%BA%A1_Long_Bay', type:'nature', from:'han', mins:150, mode:'car', hrs:10, note:'About 2.5 hours each way from Hanoi. It needs a full day or an overnight cruise.' },
  { id:'ninhbinh', n:'Ninh Binh (Trang An)', zh:'宁平', aka:['trang an','tràng an','tam coc','ninh bình'], wiki:'Tr%C3%A0ng_An', type:'nature', from:'han', mins:120, mode:'car', hrs:8, note:'Limestone karsts and boat rides, about 2 hours from Hanoi.' },
  { id:'sapa', n:'Sa Pa', zh:'沙巴', aka:['sapa'], wiki:'Sa_Pa', type:'mountain', from:'han', mins:330, mode:'bus', hrs:24, note:'Mountain rice terraces, 5 to 6 hours from Hanoi.' },
  { id:'westlakehn', n:'West Lake, Hanoi', zh:'西湖（河内）', aka:['ho tay','hồ tây','tran quoc pagoda','trấn quốc'], wiki:'West_Lake_(Hanoi)', type:'sight', from:'han', mins:20, mode:'car', hrs:1, note:'Hanoi’s biggest lake with the Tran Quoc Pagoda. Close to the Old Quarter.' },
  { id:'cuchi', n:'Cu Chi Tunnels', zh:'古芝地道', aka:['cu chi','củ chi'], wiki:'C%E1%BB%A7_Chi_tunnels', type:'sight', from:'sgn', mins:90, mode:'car', hrs:5, note:'Wartime tunnel network, about 1.5 hours from the city.' },
  { id:'mekong', n:'Mekong Delta', zh:'湄公河三角洲', aka:['my tho','mỹ tho','ben tre','bến tre'], wiki:'Mekong_Delta', type:'nature', from:'sgn', mins:120, mode:'car', hrs:8, note:'River life and floating markets, a full day from the city.' },
  { id:'warremnants', n:'War Remnants Museum', zh:'战争遗迹博物馆', aka:['war museum'], wiki:'War_Remnants_Museum', type:'sight', from:'sgn', mins:25, mode:'car', hrs:1.5, indoor:true, note:'A powerful museum, but it opens in the morning after your flight leaves.' }
];
