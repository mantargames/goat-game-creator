# Promptlar

Kullanıcının Claude Code'a tur tur yapıştırabileceği bir prompt sırası. Üç sürümlük yolculuğu izler: çirkin v1, oynanabilir v2, cilalı v3. Oyun fikrini kendi fikrinle değiştir.

## İçindekiler
- Kurulum
- v1: çirkin ama oynanabilir
- v2: oynanabilir ve dengeli
- v3: cilalı
- Her turda işe yarayan yönlendirmeler
- Ters giden promptlar

## Kurulum

> /oyun-yap Rahat bir ada kule savunması istiyorum: gündüz inşa, gece iskeletler saldırıyor. Asset'lerim ~/game-assets içinde (KayKit). Önce doctor çalıştır.

> ~/game-assets üzerinde gezgini aç ve uyumlu bir set seç: hex karolar, 4 bina, 2 düşman tipi, 1 kahraman. Seçimleri boyutlarıyla göster.

## v1: çirkin ama oynanabilir

> Oyunu başlangıç şablonundan 5151 portunda kur. Hiçbir şeyi değiştirmeden önce testleri çalıştır ve ilk ekran görüntüsünü göster.

> DESIGN.md yaz: tek sayfa, çekirdek döngü, eylemler, kazanma/kaybetme, ilk sayılar. Benim onayımı bekle.

> v1'i kur: bütün döngü sim.js'te, her sayı rules.js'te, onu oynayan bir bot ve en basit çizim. Basit şekiller yeterli. Botun node'da bir oyunu bitirdiğini kanıtla ve ?autoplay'i ekranda göster.

## v2: oynanabilir ve dengeli

> Botu 40 seed üzerinde koştur, kazanma oranını ve kaybettiği geceyi söyle. Normal zorluk yaklaşık %50 olsun.

> 3. gecede düşmanlar çok güçlü. Sadece rules.js'te düzelt, botu tekrar koştur, önce/sonra göster.

> Yükseltme ekle: kuleler ve salon 3. seviyeye çıksın. Her yeni ipucu metni için söz testi ekle.

> Basit şekilleri gerçek modellerle değiştir. Önce ?gallery çalıştır ve ekran görüntüsünü al, sonra oyunu. Ölçeği ve hiçbir şeyin havada durmadığını kontrol et.

## v3: cilalı

> Cila turu 1: ışık ve gökyüzü. Yumuşak gölgeler, ACES, sıcak bir güneş, gündüz/gece renk geçişi. Önce/sonra ekran görüntüleri.

> Cila turu 2: suyu daha güzel yap. Adanın etrafında açık renkli bir lagün ve kıyıda köpük.

> Cila turu 3: juice. Binalar taşarak belirsin, vurulan düşmanlar parlasın, ölümde duman çıksın, salona küçük bir kamera sarsıntısı.

> Cila turu 4: arayüz. Tok, okunaklı butonlar, her geceden önce tehdit bandı, düzgün bir bitiş ekranı. 1280x720'de kontrol et.

> Cila turu 5: Kenney Audio'dan ses, gündüz sakin müzik, gece gergin.

> Son kontrol: npm test, bot raporu ve bir ekran görüntüsü seti (başlık, gündüz, gece, bitiş). Hâlâ çirkin olan her şeyi listele.

## Her turda işe yarayan yönlendirmeler

- "Bunun ekran görüntüsünü göster ve ne gördüğünü söyle."
- "Bu bir his, sayı değil: botu koştur."
- "rules.js'te tut."
- "Ekran görüntüleriyle iki seçenek ver, ben seçerim."
- "O turu geri al, önceki daha iyi görünüyordu."
- "Bir ?gallery görüntüsü al, ölçek bence yanlış."

## Ters giden promptlar

- Tek promptta "bana eksiksiz bir oyun yap": test edilmemiş dev bir dosya çıkar. Tur tur ilerle.
- "AAA gibi görünsün": belirsiz. Neyi kastettiğini söyle ("su", "gece ışığı").
- Aynı anda üç asset paketini karıştırmak: stiller çatışır. Bir ana paket seç.
- Tek oyundan sonra hisle denge kurmak: her zaman bot raporu iste.
