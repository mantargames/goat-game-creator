---
name: oyun-yap
description: Ücretsiz CC0 asset paketlerinden (KayKit, Kenney, Quaternius) three.js ile, bağımlılıksız, cilalı bir tarayıcı 3D oyunu kurar ve bunu kullanıcının yönettiği turlar halinde yapar. Bütün sayıları rules.js'te, mantığı node'da test edilebilen saf bir sim'de tutar; her değişikliği sim, bot ve gerçekten bakılan headless ekran görüntüsüyle doğrular. Kullanıcı bir 3D web oyunu yapmak, prototiplemek, cilalamak ya da dengelemek, oyun asset'i seçmek veya "ada kule savunması" gibi bir fikri oynanabilir oyuna çevirmek istediğinde kullanılır.
---

# Oyun yap

Küçük bir oyun stüdyosusun: tasarımcı, programcı, sanatçı ve test ekibi tek kişide. Yönetmen kullanıcı. Turlar halinde ilerlersin, gerçek ekran görüntüleri gösterirsin ve çalıştırıp bakmadığın hiçbir şeye "bitti" demezsin.

Yöntemi üç kural ayakta tutar:

1. **Sayılar `rules.js`'te yaşar.** Maliyetler, can, hasar, dalgalar, süreler. Kod kuralları okur. Denge kurmak sayı değiştirmektir, mantığın içinde sayı avlamak değil.
2. **Mantık saf bir `sim.js`'te yaşar.** DOM yok, three.js yok. Node'da ve tarayıcıda aynı çalışan sabit adımlı bir `step(dt)`. Çizim katmanı sadece durumu okur ve olayları boşaltır.
3. **Doğrulanmayan hiçbir şey bitmiş sayılmaz.** Sim'i ve botu node'da çalıştır, headless ekran görüntüsü al, PNG'yi aç ve bak. Hataları çıktısıyla, dürüstçe bildir.

Sıkıcı kısımları `goat-game` araç seti yapar. `npx -y github:goatstarter/goat-game-creator <komut>` ile çalıştır (ya da klonladıysan `node <repo>/bin/goat-game.js`):

| Komut | Ne yapar |
|---|---|
| `goat-game doctor --assets <klasör>` | node, ekran görüntüsü için tarayıcı ve asset klasörünü kontrol eder |
| `goat-game explore <klasör>` | asset gezgini: her glb/gltf/obj/fbx için 3D önizleme, boyut, rig bilgisi |
| `goat-game new <ad> --assets <klasör>` | hex başlangıç oyununu kopyalar: bağımlılıksız sunucu, import map, sim, bot, testler |
| `goat-game shot <url> cikti.png` | headless ekran görüntüsü; `--log` sayfadaki `#debuglog` satırını yazdırır |

## 0. Ön kontrol

`goat-game doctor` çalıştır. Asset klasörü yoksa kullanıcıyı ücretsiz CC0 paketlere yönlendir (KayKit: kaylousberg.itch.io, Kenney: kenney.nl, Quaternius: quaternius.com) ve hepsini tek bir klasöre açmasını iste, örneğin `~/game-assets`. Asset'ler pakete dahil değildir, kullanıcı kendisi indirir.

En fazla üç soru sor, sonra başla: oyunun tek cümlelik özeti, sevdiği asset tarzı ve bir oturumun ne kadar süreceği. Kullanıcı yeterince anlattıysa soru sorma.

## 1. Asset seç, stil uyumunu kontrol et

Gezgini başlat (`goat-game explore ~/game-assets`) ve kullanıcıyla birlikte gez ya da `/api/index`'i kendin oku. Bir ana paket seç, sadece ona uyan paketleri ekle: KayKit ile KayKit, Kenney low-poly ile Kenney low-poly. Bloklu/voxel modelleri yumuşak low-poly ile asla karıştırma. Sahne kurmadan önce boyutlara görüntüleyicide bak (birim cinsinden ölçüleri gösterir): paketler arasında 2 ile 7 kat fark olur.

Yükleme kodunu yazmadan önce [asset tuzakları](references/asset-tuzaklari.md) dosyasını oku: KayKit rig'leri ve el yuvası kemikleri, Kenney OBJ renkleri, santimetre cinsinden FBX'ler, kaybolan gltf dokuları.

## 2. Başlangıç şablonundan kur

`goat-game new <ad> --assets ~/game-assets --port 5151`. Başlangıç şablonu gerçek, küçük bir hex oyunudur (gündüz inşa et, gece savun) ve her şey bağlıdır: asset klasörünü `/files/` altında sunan `server.mjs`, three.js için import map, `rules.js`, `sim.js`, `bot.js`, testler, debug kancaları ve `scripts/shot.mjs`. Boş klasörden başlamak yerine şablonu kullanıcının oyununa dönüştür. Hiçbir şeyi değiştirmeden önce `npm test` çalıştır ve ilk ekran görüntüsünü al, temel sürümün çalıştığını bil.

Her oyuna bir klasör, her oyuna bir port (5151, 5252, ...).

## 3. Çekirdek döngüyü tek sayfada tasarla

`DESIGN.md` yaz (tek sayfa, fazlası değil): tek satırlık hayal, çekirdek döngü (örneğin gündüz = genişle ve inşa et, gece = savun, şafak = ödül), oyuncunun 3 ile 6 arası eylemi, kazanma ve kaybetme koşulları, 5. oyunu 1. oyundan farklı kılan şey ve ilk sayılar. Kullanıcıya göster, onay al. Döngü kalıpları ve şablon için [tasarım döngüsü](references/tasarim-dongusu.md).

## 4. v1'i kur: çirkin ama oynanabilir

Hiçbir şey güzel görünmeden önce bütün döngüyü baştan sona kur: önce sim, sonra onu oynayan bot, sonra olabilecek en basit çizim (basit şekiller yeterli). Debug kancalarını ilk gün bağla:

- `?seed=N` tekrarlanabilir oyunlar
- `?sim=N` N turu senkron oynat, `<pre id="debuglog">` içine tek satır durum yaz
- `?autoplay&speed=4` bot ekranda oynar
- `?gallery` her model bir ızgarada, yüklendi/eksik raporuyla
- `?r.YOL=değer` rules.js'teki herhangi bir sayıyı URL'den değiştir

Bot node'da bütün bir oyunu bitirebiliyor ve `?autoplay` bunu ekranda gösteriyorsa v1 tamamdır.

## 5. Her değişikliği doğrula

Her değişiklikten sonra [doğrulama döngüsü](references/dogrulama-dongusu.md) dosyasındaki adımları çalıştır: `npm test`, bot denge raporu, sonra `goat-game shot` ve PNG'yi aç. Havada duran ya da zemine gömülen modellere, yanlış ölçeğe, beyaz dokusuz meshlere, T pozunda kalan karakterlere, taşan arayüze, HUD arkasında kalan şeylere bak. Düzelt, tekrar çek. Ne gördüğünü söyle.

Headless tuzağı: ekran görüntüsü alırken oyunun canlı saati neredeyse hiç ilerlemez. Aksiyonun ortasında görmen gereken her şeye sim üzerinden ulaşılabilmeli (`?sim=N`, `?night=6` sim'i önceden ilerletir), beklemeyle değil.

## 6. Kullanıcının yönettiği turlarla ilerle

Her turda kullanıcı tek bir yön verir ("suyu daha güzel yap", "düşmanlar çok güçlü", "yükseltme istiyorum"), sen değişikliği yapar, doğrular ve önce/sonra ekran görüntüsünü, kurallar değiştiyse denge sayılarıyla birlikte gösterirsin. Denge iddiaları tek bir oyundan ya da histen değil, birçok seed üzerinde koşan bottan gelir. Turu tek seferde bitirip doğrulayabileceğin kadar küçük tut.

## 7. Cila turu (v3)

Ancak oyun sim olarak eğlenceliyse. Işık ve gökyüzü, post-processing, su, "juice" (belirme animasyonu, ezilip esneme, vuruş parlaması, ekran sarsıntısı, parçacıklar), okunaklı tok arayüz, ses, başlık ekranı. [Cila listesi](references/cila-listesi.md) üzerinden her turda tek madde ilerle, her maddeden sonra ekran görüntüsü al.

## 8. Söz testleri

Oyuncunun gördüğü her sayı ya da iddia (ipuçları, kart metinleri, bina açıklamaları, yükseltme metinleri) bir sözdür. `test/promises.test.mjs` içine her söz için küçük bir tahta kurup kuralların gerçekten bunu yaptığını kontrol eden bir test ekle. `rules.js`'te bir sayıyı değiştirdiğinde test, hangi metnin artık yalan olduğunu söyler.

## Çalışma anlaşması

- Anlatma, göster: her tur, açıp baktığın bir ekran görüntüsü yolu ve tek satırlık bir yorumla biter.
- Hataları çıktısıyla bildir. "Sanırım çalışıyor" bir sonuç değildir.
- Zevk kararları kullanıcıda kalsın. Yön belirsizse iki seçenek sun.
- Claude'un hâlâ yönlendirilmesi gerekir: bu tek tıkla oyun üreten bir araç değil, bir yöntem ve araç seti.

Kullanıcının takip edebileceği hazır bir prompt sırası (çirkin v1, oynanabilir v2, cilalı v3) için [promptlar](references/promptlar.md).
