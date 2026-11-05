# Tasarım döngüsü

"X hakkında bir oyun istiyorum" cümlesini, güzelleşmeden önce sayılar olarak eğlenceli olan bir döngüye çevirmenin yolu.

## İçindekiler
- Tek sayfalık tasarım
- Tarayıcıda işe yarayan döngü kalıpları
- İlk sayılar
- Oyunları birbirinden farklı kılmak
- Şablon

## Tek sayfalık tasarım

`DESIGN.md` içine yazılan, koddan önce kullanıcının onayladığı tek sayfa:

1. **Hayal**, tek satır: "Minik bir ada krallığı büyüt ve onu ölülere karşı koru."
2. **Çekirdek döngü**: tekrar eden 2 ya da 3 evre.
3. **Eylemler**: oyuncunun yaptığı 3 ile 6 şey (yerleştir, inşa et, yükselt, büyü yap, topla).
4. **Kazanma ve kaybetme**: bir oyun nasıl biter.
5. **Çeşitlilik**: 5. oyunu 1. oyundan farklı kılan şey.
6. **Oturum süresi**: 5, 15 ya da 45 dakika.
7. **İlk sayılar**: doğrudan `rules.js`'e giden küçük bir tablo.

## Tarayıcıda işe yarayan döngü kalıpları

- **İnşa et / savun** (gündüz/gece): sakin planlama, sonra çoğunlukla izlediğin gergin bir dalga. Botla doğrulaması çok kolay. Hex Kingdom ve başlangıç şablonu bunu kullanır.
- **Genişle / değerlendir**: her tur bir karo yerleştir (kartlar), komşuluk bonusları akıllı yerleşimi ödüllendirir.
- **Topla / üret / hayatta kal**: kaynaklar azalır, oyuncu onları yukarıda tutar.
- **Koş / yükselt**: kısa oyunlar, turlar arasında 3 yükseltmeden birini seç (roguelite).
- **Bulmaca turları**: deterministik turlar, sim ve geri alma için biçilmiş kaftan.

Birini seç. En fazla ikisini birleştir.

## İlk sayılar

İlk iki turu kolay, son turu zor yapan yuvarlak sayılarla başla. Botu 40 seed oynat ve net bir eğri hedefle (kayıplar 1. turda değil, sona doğru yoğunlaşsın). Her seferinde tek bir sayı değiştir.

İyi ilk ayarlar: başlangıç kaynakları, bina başına gelir, tur başına düşman canı artışı, tur başına düşman sayısı, kule hasarı ve menzili.

## Oyunları birbirinden farklı kılmak

Seed ile harita üretimi, rastgele bir seçim havuzu (kartlar, lütuflar, yükseltmeler), sabit turlarda boss'larla artan tehdit ve bedeli olan bir karar (şimdi ekonomiye mi yatırım, savunmaya mı).

## Şablon

```markdown
# <Oyun adı>
Hayal: ...
Döngü: gündüz (...) -> gece (...) -> şafak (...)
Eylemler: ...
Kazanma: ... / Kaybetme: ...
Çeşitlilik: ...
Oturum: ... dakika
İlk sayılar:
| şey | değer |
|---|---|
```
