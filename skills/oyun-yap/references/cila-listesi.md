# Cila listesi

Bu listeye ancak oyun sim olarak eğlenceliyse geç. Her turda tek madde, her maddeden sonra ekran görüntüsü; daha iyi görüneni tut, görünmeyeni geri al.

## İçindekiler
- Işık ve gökyüzü
- Post-processing
- Su ve zemin
- Juice
- Arayüz
- Ses
- His ve ilk deneyim
- Performans

## Işık ve gökyüzü

- `renderer.toneMapping = THREE.ACESFilmicToneMapping`, sRGB çıktı, pozlama 1 civarı.
- Yumuşak gölgeli sıcak bir ana ışık (`PCFSoftShadowMap`, oyun alanını saran dar bir gölge kamerası, 2048 ya da 4096 harita), üstüne gökyüzü/zemin dolgusu için hemisphere ışığı.
- Görüntü tabanlı aydınlatma: bir `PMREMGenerator` ortamı (RoomEnvironment ya da gökyüzü) malzemelerin doğru okunmasını sağlar.
- Gündüz/gece: gökyüzü rengini, güneşin şiddetini ve rengini, sis rengini yumuşakça geçir. Ekran görüntüsü için önceden ilerletirken anında geç.

## Post-processing

Sırasıyla `EffectComposer` içinde: render pass, ortam gölgelemesi (`GTAOPass`), yumuşak bloom (`UnrealBloomPass`, düşük güç, yüksek eşik), bir renk düzenleme shader'ı (doygunluk, kontrast, lift, vinyet), `OutputPass`. AO geçişi sırasında sprite'ları ve parçacıkları gizle, yoksa koyu haleler bırakırlar. Işıklar parlasın diye gece bloom'u artır.

## Su ve zemin

- Deniz: addons içindeki three.js `Water` ya da basit animasyonlu bir malzeme; karanın etrafındaki açık renkli bir lagün halkası anında sığ su olarak okunur.
- Kıyıyı takip eden köpük (bulanıklaştırılmış bir kara maskesi yeterli).
- Zemin örtüsü: her karoya deterministik olarak küçük çimen tutamları, çakıllar ve çalılar serp, açık arazi hiç düz görünmesin.

## Juice

- İnşa edilen şey taşarak belirsin, vuruşta ezilip esnesin.
- Vuruş parlaması (100 ms kırmızı ton), uçuşan hasar ya da gelir sayıları.
- Parçacıklar: inşaatta toz, ölümde duman, vuruşta kıvılcım, bacalardan duman.
- Büyük darbelerde küçük kamera sarsıntısı, her vuruşta değil.
- Hayat: gündüz gezinen köylüler, dalgalanan bayraklar, süzülen bulutlar.

## Arayüz

- Tok, okunaklı yazı (konturlu bir başlık fontu), yüksek kontrast, büyük tıklama alanları.
- Gösterilen her sayının arkasında bir söz testi olsun.
- Her şeyde ipucu, her dalgadan önce bir tehdit bandı, net bir bitiş ekranı.
- Arayüzü ekran görüntüsünde 1280x720 ve 1920x1080'de kontrol et.

## Ses

Önce prosedürel (WebAudio sesleri), sonra gerçek örnekler: Kenney Audio paketleri CC0'dır. Sakin ve gergin evreler için ayrı müzik, kısa arayüz tıklamaları, hafif rastgele perdeyle darbe sesleri.

## His ve ilk deneyim

Başlık ekranı, devam et/kaydet (localStorage), planlama eylemleri için geri al, her evrede ilk oyuna özel tek satırlık ipucu, hız düğmesi (x2), duraklat.

## Performans

Geometrileri ve malzemeleri paylaş, modelleri yeniden yüklemek yerine kopyala, çok sayıda aynı eşya için `InstancedMesh` kullan, piksel oranını 2 ile sınırla, kare süresini büyük bir oyun sonu durumuyla kontrol et (`?sim=12`).
