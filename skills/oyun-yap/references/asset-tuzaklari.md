# Asset tuzakları

KayKit, Kenney ve Quaternius paketleriyle oyun yaparken zor yoldan öğrenilen dersler. Yeni bir paket için yükleme kodu yazmadan önce ilgili maddeye bak.

## İçindekiler
- KayKit karakterleri ve rig'ler
- Silahlar ve el yuvaları
- Kenney OBJ + MTL renkleri
- Paketler arası ölçek
- Kaybolan glTF dokuları
- FBX birimleri ve dokuları
- Çift formatlar ve sürümler
- Stil uyumu

## KayKit karakterleri ve rig'ler

Bir KayKit karakteri ancak glb dosyasında skin varsa (`skins` > 0) ve standart kemik adları bulunuyorsa (Rig_Medium'da `hand.r`, `handslot.r`) animasyon oynatır. O zaman ortak klip dosyaları (`Rig_Medium_General.glb`, `Rig_Medium_MovementBasic.glb`, Character Animations içindeki `CombatMelee` vb.) kemik adlarına göre karaktere oturur: klipleri bir kez yükle, aynı rig'e sahip her karakterde oynat. Büyük yaratıklar kendi klip setiyle Rig_Large kullanır.

Bazı "mini pack" ya da "warband" karakterleri iskeletsiz, gevşek parçalardan oluşur. Animasyon verilince dağılırlar, onları sabit dekor olarak kullan. Teşhis için modeli gezginde aç: görüntüleyici `rig: none` ve bir uyarı gösterir. Ya da glb JSON'unu döküp `skins` alanına bak.

Rig_Large ve Rig_Medium kemik adlarının çoğunu paylaşır ama oranları farklıdır: Rig_Large klibi Rig_Medium karakterine verilirse karakter dağılır. Rig'in kök düğümünün adı `Rig_Medium` ya da `Rig_Large` olur, klip dosyalarını bu ada göre eşleştir. Gezgin klip ödünç alırken bunu yapar.

Rig'li karakterleri `object.clone()` ile değil `SkeletonUtils.clone()` ile kopyala, yoksa bütün kopyalar tek iskeleti paylaşır.

## Silahlar ve el yuvaları

Silahları `handslot.r` / `handslot.l` kemiklerine bağla (three.js bunlara `handslotr` / `handslotl` der). Bazı maceracı modelleri bütün silah çeşitlerini aynı anda gömülü getirir: biri hariç hepsini gizle, yoksa birim elinde üç kılıçla gezer.

## Kenney OBJ + MTL renkleri

Blender, MTL renklerini (`Kd`) lineer uzayda dışa aktarır; three.js MTLLoader ise bunları sRGB sanar, her şey koyu ve çamurlu görünür. Yüklerken düzelt: `material.color.convertLinearToSRGB()`. Ayrıca `side: THREE.DoubleSide` ver: Kenney tenteleri ve branda yüzeyleri tek yüzlüdür, arkadan bakınca kaybolur. Kenney kitlerinin GLB sürümü varsa onu tercih et.

## Paketler arası ölçek

Kenney binaları yaklaşık 1 birim yüksekliğinde, KayKit karakterleri yaklaşık 1,9, KayKit hex karoları 2,0 genişliğinde (düz kenardan düz kenara), KayKit kalesi yaklaşık 4. Paketleri karıştırmak 2 ile 7 kat arası ölçek ister. Tahmin etme, ölç: gezginin görüntüleyicisi boyutları gösterir ya da `new THREE.Box3().setFromObject(obj).getSize(v)` ile hesapla. Model başına ölçeği tek bir tabloda tut (başlangıç şablonu `assets.js` içinde `SCALE` kullanır).

## Kaybolan glTF dokuları

Bir `.gltf` dosyası dokusunu göreli bir `images[].uri` ile çağırır. O dosya gltf'nin yanında değilse sessiz bir 404 alırsın ve mesh beyaz, dokusuz görünür. Çözüm: dokunun durduğu klasörden yükle (paketler genelde `Assets/gltf/` altında eksiksiz bir kopya getirir) ya da atlas dosyasını modelin yanına kopyala. Gezginin görüntüleyicisi eksik dosyaları işaretler.

## FBX birimleri ve dokuları

Birçok mağazadan gelen FBX dosyaları santimetre cinsindendir: bir sokak lambası 1000 birim çıkar. 0,01 ile ölçekle. `three/addons/loaders/FBXLoader.js` doğrudan import map'ten yüklenir. Dokular çoğu zaman otomatik bulunmaz (mesh ve doku adlarının önekleri farklıdır): her dokuyu kendin bir `MeshStandardMaterial` üzerine yükle, `tex.flipY = false` ve `tex.colorSpace = THREE.SRGBColorSpace` ile. Emission haritaları lambaların ve ateşlerin gece parlamasını sağlar. `.tga` için `TGALoader` gerekir.

## Çift formatlar ve sürümler

Paketler aynı modeli glb, gltf, obj ve fbx olarak, bazen de FREE ve EXTRA sürümleriyle iki kez getirir. glb > gltf > obj > fbx sırasını ve tek bir sürümü tercih et. Gezgin bunları zaten tek kartta birleştirir. Renk varyantları (`_red`, `_blue`, `_Color1`) tek bir modelin çeşitleridir, her taraf için birini seç.

## Stil uyumu

Bir ana paket seç ve sadece onun görünüşüne uyan paketleri ekle: aynı poligon yoğunluğu, aynı renk mantığı (düz renk mi doku mu), aynı oranlar. KayKit ile KayKit güvenlidir. Bloklu/voxel modeller yumuşak low-poly'nin yanında her zaman yanlış durur. Emin değilsen ikisini `?gallery` içine koy ve yan yana ekran görüntüsünü al.
