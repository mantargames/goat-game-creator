# Doğrulama döngüsü

Bunu her değişiklikten sonra çalıştır. Her adım geçmeden ve ekran görüntüsüne bakmadan değişiklik bitmiş sayılmaz.

## İçindekiler
- Döngü
- İlk gün kurulacak debug kancaları
- Sayfayı komut satırından okumak
- Ekran görüntüsünde nelere bakılır
- Botla denge testi
- Headless tuzakları

## Döngü

```bash
npm test                                              # sim kuralları, sözler, denge raporu
node server.mjs &                                     # zaten çalışmıyorsa
goat-game shot "http://localhost:5151/?seed=7&sim=3" shots/t12-gunduz.png
goat-game shot "http://localhost:5151/?seed=7&sim=3&night=6" shots/t12-gece.png
goat-game shot "http://localhost:5151/?seed=7&sim=3" --log      # #debuglog satırı
```

Sonra her PNG'yi aç (görseli oku) ve ne gördüğünü tek satırla yaz. Önce/sonra karşılaştırması kolay olsun diye görüntüleri tur numarasıyla adlandır (`t12-...`). Kontrol için bir sunucu başlattıysan iş bitince durdur.

## İlk gün kurulacak debug kancaları

- `?seed=N`: aynı seed aynı haritayı ve aynı oyunu verir.
- `?sim=N`: bot N turu senkron oynar, sonra o durum çizilir. `<pre id="debuglog" hidden>` içine tek satırlık özet yazılır.
- `?autoplay&speed=4`: bot ekranda oynar, izlemek ve video çekmek için.
- `?gallery`: manifestteki her model etiketli bir ızgarada, bulundu/eksik/hatalı satırıyla. Asset eklediğin her seferde çalıştır.
- `?r.START.gold=500`: rules içindeki herhangi bir değeri URL'den değiştir.
- `?noassets`: paket olmadan oyunun çalıştığını kanıtlamak için basit şekillere zorla.
- `window.GAME`: konsolda `state`, sim ve sahneye erişim.

## Sayfayı komut satırından okumak

`goat-game shot <url> --log` (ya da `chrome --headless --dump-dom <url> | grep debuglog`) debug satırını yazdırır. Gerçek tarayıcı derlemesinde mantığı kontrol etmek için kullan, örneğin `?sim=6` ile 6. geceye salon ayaktayken ulaşıldığını.

Ayrıntı için HUD bölgesini Python PIL ile kırp:
`python3 -c "from PIL import Image; Image.open('s.png').crop((0,720,1440,900)).save('hud.png')"`

## Ekran görüntüsünde nelere bakılır

- karoların üstünde havada duran ya da içine gömülen modeller (yanlış y ofseti ya da pivot)
- paketler arası yanlış ölçek, dev eşyalar, minik karakterler
- beyaz, dokusuz meshler (eksik gltf dokusu)
- T pozunda ya da dağılmış karakterler (rig yok, yanlış kopyalama, eksik klip)
- üst üste binen yüzeylerde z-fighting ya da titreme
- kutusundan taşan arayüz metni, aksiyonu kapatan HUD, okunmayan kontrast
- her şey çok karanlık ya da soluk (tone mapping, renk uzayı)
- kamera kadrajı: ilginç kısım ekranda mı?

## Botla denge testi

Oyuncuyla aynı API üzerinden oynayan açgözlü bir bot, tek dürüst denge testidir. Her zorluk için 20 ile 60 seed arasında koştur ve şunu raporla: kazanma oranı, kayıpların yaşandığı tur (histogram) ve zaman içinde kaynaklar. Örnek hedef aralıklar: zayıf bir bot için kolay %85-95, normal %40-60. Kullanıcı "çok zor" dediğinde `rules.js`'te tek bir sayı değiştir, botu tekrar koştur ve önce/sonra oranını bildir.

## Headless tuzakları

- `--virtual-time-budget` ile zamanlayıcılar hızlı akar ama canlı rAF saati neredeyse hiç ilerlemez, zamana bağlı her şey sıfıra yakın okunur. Görmen gerekeni deterministik `step(dt)` yoluna koy ve önceden ilerlet (`?sim=N`, `?night=6`).
- Headless Chrome'da WebGL yazılımsal GL ister: shot betiği `--use-angle=swiftshader --enable-unsafe-swiftshader` verir.
- Fontlar ve CDN betikleri ilk yüklemede internet ister.
- Görüntü siyah çıkıyorsa renderer'a `preserveDrawingBuffer: true` ver.
