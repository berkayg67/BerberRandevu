import { COMPANY } from "./company";

export type Block = { h?: string; p?: string[]; ul?: string[] };
export type LegalDoc = { slug: string; title: string; short: string; intro: string; blocks: Block[] };

const who = [
  `Unvan: ${COMPANY.name}`,
  `Adres: ${COMPANY.address}`,
  `E-posta: ${COMPANY.email}`,
  ...(COMPANY.kep ? [`KEP: ${COMPANY.kep}`] : []),
  ...(COMPANY.registryNo ? [`Vergi/MERSİS no: ${COMPANY.registryNo}`] : []),
];

const rights = {
  h: "Haklarınız",
  p: [
    "6698 sayılı Kişisel Verilerin Korunması Kanunu'nun 11. maddesi uyarınca veri sorumlusuna başvurarak şunları isteyebilirsiniz:",
  ],
  ul: [
    "Kişisel verilerinizin işlenip işlenmediğini öğrenmek ve işlenmişse buna ilişkin bilgi talep etmek",
    "İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenmek",
    "Yurt içinde veya yurt dışında verilerin aktarıldığı üçüncü kişileri bilmek",
    "Eksik veya yanlış işlenmiş verilerin düzeltilmesini istemek",
    "Kanun'da öngörülen şartlar çerçevesinde verilerin silinmesini veya yok edilmesini istemek ve bunun aktarıldığı üçüncü kişilere bildirilmesini talep etmek",
    "İşlenen verilerin yalnızca otomatik sistemlerle analiz edilmesi sonucunda aleyhinize bir sonuç çıkmasına itiraz etmek",
    "Kanuna aykırı işleme nedeniyle zarara uğramanız hâlinde zararın giderilmesini talep etmek",
  ],
};

const apply = {
  h: "Başvuru yolu",
  p: [
    "Taleplerinizi yazılı olarak ya da kayıtlı elektronik posta (KEP) adresi, güvenli elektronik imza veya daha önce bildirdiğiniz e-posta adresi ile iletebilirsiniz. Başvurunuz en geç otuz gün içinde sonuçlandırılır. Cevabımızdan memnun kalmazsanız, cevabı öğrendiğiniz tarihten itibaren otuz gün içinde ve her hâlükârda başvuru tarihinden itibaren altmış gün içinde Kişisel Verileri Koruma Kurulu'na şikâyette bulunabilirsiniz.",
  ],
};

export const LEGAL_DOCS: LegalDoc[] = [
  {
    slug: "musteri-aydinlatma",
    title: "Müşteri aydınlatma metni",
    short: "Randevu alan müşteriler için",
    intro:
      "Bu metin, bir berber dükkânından Tıraş Vakti üzerinden randevu alan kişileri, 6698 sayılı Kanun'un 10. maddesi uyarınca bilgilendirmek için hazırlanmıştır. Okumanız bir onay vermek anlamına gelmez; randevu almak için bu metne onay vermeniz gerekmez.",
    blocks: [
      {
        h: "Veri sorumlusu kimdir",
        p: [
          "Randevu aldığınız berber dükkânı, verilerinizin veri sorumlusudur. Dükkânın adı ve adresi randevu sayfasında yazar.",
          "Tıraş Vakti, dükkânın randevu sistemini sağlayan hizmet sağlayıcıdır ve dükkânın talimatıyla verilerinizi onun adına işleyen veri işleyendir:",
        ],
        ul: who,
      },
      {
        h: "Hangi verileriniz işlenir",
        ul: [
          "Kimlik ve iletişim: adınız, soyadınız, cep telefonu numaranız",
          "Randevu bilgisi: seçtiğiniz hizmet, usta, tarih ve saat, randevunun alındığı yol, iptal bilgisi",
          "Dükkânın tuttuğu kayıt: randevuya gelip gelmediğiniz, dükkânın engelleme kaydı varsa o kayıt",
          "Mesaj kayıtları: size gönderilen WhatsApp mesajının içeriği ve gönderim durumu",
          "Rıza kaydı: isteğe bağlı açık rıza verdiyseniz, verdiğiniz tarih ve saat",
        ],
        p: ["Konum, kimlik belgesi, ödeme kartı bilgisi veya sağlık verisi istenmez ve işlenmez."],
      },
      {
        h: "Hangi amaçla ve hangi hukuki sebeple işlenir",
        ul: [
          "Randevunuzu oluşturmak, değiştirmek, iptal etmek ve size onay ile hatırlatma mesajı göndermek. Hukuki sebep: bir sözleşmenin kurulması veya ifasıyla doğrudan ilgili olması (Kanun m.5/2-c)",
          "Aynı saate birden fazla kişiye randevu verilmesini ve randevuya gelinmemesi nedeniyle dükkânın zarar görmesini önlemek, dükkânın engelleme listesini yönetmek. Hukuki sebep: ilgili kişinin temel hak ve özgürlüklerine zarar vermemek kaydıyla veri sorumlusunun meşru menfaatleri (m.5/2-f)",
          "Hizmetin güvenliğini sağlamak ve kötüye kullanımı önlemek. Hukuki sebep: meşru menfaat (m.5/2-f)",
          "Randevunuzdan sonra teşekkür ve yorum isteği mesajı göndermek. Hukuki sebep: yalnızca verdiğiniz açık rıza (m.5/1). Bu rıza ayrı bir metinle ve isteğe bağlı olarak alınır",
        ],
      },
      {
        h: "Verileriniz kimlere ve nereye aktarılır",
        p: [
          "Verileriniz, randevu aldığınız dükkânla ve onun çalışanlarıyla paylaşılır. Başka dükkânlar verilerinizi göremez.",
          "Hizmetin sunulması için kullanılan hizmet sağlayıcılar verilerinizi yurt dışındaki sunucularda işleyebilir: veritabanı ve barındırma hizmeti (Avrupa Birliği'nde, Almanya'daki veri merkezleri) ve WhatsApp mesaj altyapısı (Meta Platforms). Bu aktarımlar Kanun'un 9. maddesinde öngörülen yöntemlerle, yani yeterlilik kararı veya uygun güvenceler çerçevesinde yapılır.",
          "Yasal bir yükümlülük gerektirdiğinde yetkili kamu kurumlarına bilgi verilebilir. Verileriniz satılmaz ve reklam amacıyla üçüncü kişilerle paylaşılmaz.",
        ],
      },
      {
        h: "Verileriniz ne kadar saklanır",
        p: [
          "Randevu kayıtları, dükkân hizmeti kullandığı sürece ve dükkânın hak taleplerine karşı delil olarak ihtiyaç duyduğu makul süre boyunca saklanır. Silme talebiniz, saklanmasını gerektiren bir yasal sebep yoksa yerine getirilir. Rızanızı geri çektiğinizde teşekkür mesajı gönderimi durdurulur.",
        ],
      },
      {
        h: "Verilerinizi nasıl topluyoruz",
        p: [
          "Verileriniz, randevu formunu doldurduğunuzda veya dükkân sizi telefonla arayıp randevunuzu kendisi eklediğinde, tamamen otomatik olmayan ve elektronik yolla toplanır.",
        ],
      },
      rights,
      apply,
    ],
  },
  {
    slug: "acik-riza",
    title: "Teşekkür mesajı için açık rıza metni",
    short: "İsteğe bağlı, randevu için gerekmez",
    intro:
      "Bu metin aydınlatma metninden ayrıdır. Vermek tamamen isteğe bağlıdır; vermezseniz randevunuz aynen alınır, onay ve hatırlatma mesajlarınız da size gönderilir.",
    blocks: [
      {
        h: "Neye rıza veriyorsunuz",
        p: [
          "Randevunuz bittikten kısa bir süre sonra, randevu aldığınız dükkân adına cep telefonunuza WhatsApp üzerinden bir teşekkür mesajı ve varsa dükkânın Google yorum bağlantısını içeren bir yorum isteği gönderilmesine ve bu amaçla adınızın, telefon numaranızın ve randevu bilgilerinizin işlenmesine açık rıza veriyorsunuz.",
        ],
      },
      {
        h: "Önemli bilgiler",
        ul: [
          "Bu rıza, randevu almanın veya herhangi bir hizmetin şartı değildir.",
          "Rızanızı dilediğiniz zaman, hiçbir gerekçe göstermeden geri alabilirsiniz. Geri çekme, daha önce yapılan işlemlerin hukuka uygunluğunu etkilemez.",
          "Rıza verdiğinizde, verdiğiniz tarih ve saat kaydedilir.",
          "Bu mesaj yalnızca bir teşekkür ve yorum rica etmektir; kampanya veya reklam içermez.",
        ],
      },
      {
        h: "Rızayı nasıl geri alırsınız",
        p: [
          `Randevu aldığınız dükkâna telefonla ulaşarak ya da ${COMPANY.email} adresine yazarak rızanızı geri alabilirsiniz. Talebiniz iletildiği andan itibaren teşekkür mesajı gönderilmez.`,
        ],
      },
    ],
  },
  {
    slug: "berber-aydinlatma",
    title: "Berber hesabı aydınlatma metni",
    short: "Dükkân sahipleri için",
    intro:
      "Bu metin, Tıraş Vakti'ne dükkânını kaydeden ve hesap açan kişileri 6698 sayılı Kanun'un 10. maddesi uyarınca bilgilendirir.",
    blocks: [
      {
        h: "Veri sorumlusu",
        p: ["Hesap ve abonelik verilerinizin veri sorumlusu Tıraş Vakti'ni işleten:"],
        ul: who,
      },
      {
        h: "Hangi verileriniz işlenir",
        ul: [
          "Kimlik ve iletişim: adınız, soyadınız, cep telefonunuz, e-posta adresiniz",
          "Dükkân bilgisi: dükkânın adı, adresi, telefonu, çalışma saatleri, hizmetler ve fiyatlar, tanıtım metni, yüklediğiniz fotoğraflar",
          "Hesap güvenliği: şifrenizin tek yönlü özeti (şifreniz okunamaz biçimde saklanır), oturum kayıtları, son giriş zamanı",
          "Abonelik: aylık ücret, ödeme dönemleri, ödeme yöntemi ve tahsilat notları",
          "Başvuru kaydı: kullanım koşullarını kabul ettiğiniz tarih ve saat",
        ],
      },
      {
        h: "Amaç ve hukuki sebep",
        ul: [
          "Başvurunuzu değerlendirmek, hesabınızı açmak ve randevu sistemini size sunmak. Hukuki sebep: sözleşmenin kurulması ve ifası (m.5/2-c)",
          "Abonelik ücretini takip etmek, tahsil etmek ve muhasebe kayıtlarını tutmak. Hukuki sebep: sözleşmenin ifası ve hukuki yükümlülük (m.5/2-c, m.5/2-ç)",
          "Şifre talebinizi yanıtlamak, hesabınızı ve sistemi güvende tutmak. Hukuki sebep: meşru menfaat (m.5/2-f)",
        ],
      },
      {
        h: "Aktarım",
        p: [
          "Verileriniz yalnızca hizmetin sunulması için kullanılan hizmet sağlayıcılarla paylaşılır: veritabanı ve barındırma hizmeti (Avrupa Birliği'nde, Almanya'daki veri merkezleri). Aktarımlar Kanun'un 9. maddesinde öngörülen yöntemlerle yapılır. Yasal yükümlülük hâlinde yetkili kurumlara bilgi verilebilir. Verileriniz satılmaz.",
          "Dükkânınızın müşterilerine ait veriler için veri sorumlusu siz, veri işleyen Tıraş Vakti'dir; bu konu Kullanım Koşulları'nda düzenlenir.",
        ],
      },
      {
        h: "Saklama süresi",
        p: [
          "Hesap bilgileriniz, hesabınız açık olduğu sürece saklanır. Hesabınız kapandıktan sonra, ücret kayıtları gibi yasal saklama süresi bulunan veriler dışındakiler silinir veya anonim hâle getirilir. Vergi mevzuatı gereği ücret kayıtları yasal süre boyunca saklanır.",
        ],
      },
      rights,
      apply,
    ],
  },
  {
    slug: "kullanim-kosullari",
    title: "Berber kullanım koşulları",
    short: "Dükkân sahipleriyle sözleşme",
    intro:
      "Bu koşullar, Tıraş Vakti randevu sistemini kullanan berber dükkânları ile hizmeti sunan arasındaki sözleşmenin şartlarıdır. Başvuru formunda onayladığınızda yürürlüğe girer.",
    blocks: [
      {
        h: "Taraflar ve hizmet",
        p: [
          `Hizmeti sunan: ${COMPANY.name}. Dükkân: başvuru formunda kayıt olan işletme (bundan sonra "dükkân").`,
          "Tıraş Vakti; müşterilerin dükkânınızın boş saatlerini görüp randevu almasını, randevuların takvimde izlenmesini ve onay, hatırlatma ve iptal mesajlarının WhatsApp üzerinden iletilmesini sağlayan bir yazılım hizmetidir.",
        ],
      },
      {
        h: "Başvuru ve hesap",
        ul: [
          "Başvurular incelenir; onaylanana kadar dükkânınızın randevu sayfası açılmaz ve panele giriş yapılamaz. Başvuruyu gerekçe göstermeksizin reddetme hakkımız saklıdır.",
          "Başvuruda verdiğiniz bilgilerin doğru ve güncel olması sizin sorumluluğunuzdadır.",
          "Hesabınızın şifresini gizli tutmak sizin sorumluluğunuzdadır. Şifrenizi unutursanız yeni şifre, kayıtlı telefon numaranız aranarak iletilir.",
        ],
      },
      {
        h: "Ücret",
        p: [
          "Hizmetin aylık ücreti sizinle ayrıca kararlaştırılır ve panelde dükkânınız için gösterilir. Ücretsiz kullanım dönemi varsa süresi yine sizinle kararlaştırılır. Ücret değişikliği, yürürlüğe girmeden önce size bildirilir. Ödenmeyen ücret hâlinde, bildirim yapılarak hizmet askıya alınabilir.",
        ],
      },
      {
        h: "Müşteri verileri ve sorumluluklar",
        ul: [
          "Müşterilerinizin kişisel verileri bakımından veri sorumlusu dükkânınızdır; Tıraş Vakti yalnızca sizin adınıza ve talimatınız doğrultusunda randevu hizmetinin gerektirdiği kadar işleyen veri işleyendir.",
          "Müşterilere gösterilen aydınlatma metni ve isteğe bağlı açık rıza metni Tıraş Vakti tarafından hazırlanmıştır ve randevu formunda sunulur. Bu metinler yasal bilgilendirme yükümlülüğünüzün yerine getirilmesine yardımcı olur; dükkânınıza özgü başka veri işleme faaliyetleriniz varsa bunların yükümlülüğü size aittir.",
          "Müşteri verilerini randevu hizmeti dışındaki amaçlarla, özellikle reklam ve kampanya iletisi için kullanmamayı; müşterilerin rızası olmadan toplu mesaj göndermemeyi kabul edersiniz.",
          "Panelde ekleyeceğiniz randevular için müşteriyle iletişim kurmadan önce, müşterinin telefonla verdiği bilgilerin işlenmesi konusunda onu bilgilendirmekten siz sorumlusunuz.",
          "Müşteri engelleme özelliğini yalnızca haklı sebeple, örneğin tekrarlayan gelmeme durumunda ve ölçülü biçimde kullanırsınız.",
          "Yüklediğiniz fotoğraf ve metinlerin üçüncü kişilerin haklarını ihlal etmemesi, fotoğraflardaki kişilerin görüntülerinin yayımlanması için gerekli izinlerin alınmış olması sizin sorumluluğunuzdadır.",
        ],
      },
      {
        h: "WhatsApp mesajları",
        p: [
          "Mesajlar, WhatsApp altyapısı üzerinden gönderilir. Mesajların iletilmesi, alıcının numarasına, WhatsApp'ın kurallarına ve internet bağlantısına bağlıdır; her mesajın ulaşacağı garanti edilemez. Mesaj gönderimi, ayrı bir bildirimle duyurulacak tarihte etkinleşebilir.",
        ],
      },
      {
        h: "Hizmetin sürekliliği ve sorumluluk",
        p: [
          "Hizmeti kesintisiz ve hatasız sunmak için makul özeni gösteririz; ancak bakım, üçüncü taraf hizmetlerdeki aksaklıklar veya mücbir sebepler nedeniyle kesinti yaşanabilir. Kasıt ve ağır kusur dışında, dolaylı zararlardan ve kâr kaybından sorumlu olmayız. Toplam sorumluluğumuz, olayın meydana geldiği tarihten önceki on iki ayda ödediğiniz ücretle sınırlıdır; bu sınırlama, Türk hukukunun sınırlandırmaya izin vermediği hâller için geçerli değildir.",
        ],
      },
      {
        h: "Fesih ve veri iadesi",
        p: [
          "Dilediğiniz zaman bize bildirerek hesabınızı kapattırabilirsiniz. Kullanım koşullarının ağır ihlali hâlinde hizmeti bildirim yaparak askıya alabilir veya sonlandırabiliriz. Sona erme hâlinde dükkânınızın verilerinin bir kopyasını isteyebilirsiniz; ardından veriler, yasal saklama zorunluluğu olanlar dışında, makul sürede silinir.",
        ],
      },
      {
        h: "Değişiklik ve uyuşmazlık",
        p: [
          "Koşullarda önemli bir değişiklik yaptığımızda yürürlüğe girmeden önce size bildiririz. Bu koşullara Türk hukuku uygulanır. Uyuşmazlıklarda İstanbul mahkemeleri ve icra daireleri yetkilidir. Tüketici sıfatındaki kişiler için kanunun verdiği yetki kuralları saklıdır.",
        ],
      },
      { h: "İletişim", ul: who },
    ],
  },
  {
    slug: "cerez",
    title: "Çerez ve yerel depolama bilgisi",
    short: "Çerez kullanımı",
    intro:
      "Tıraş Vakti reklam, izleme veya istatistik çerezi kullanmaz. Yalnızca sitenin çalışması için gerekli olan aşağıdaki kayıtlar tarayıcınıza yazılır.",
    blocks: [
      {
        h: "Kullandığımız kayıtlar",
        ul: [
          "berber_oturum (çerez): Berber veya yönetici girişi yaptığınızda oturumunuzu tanır. Yalnızca giriş yapanlarda oluşur, on dört gün sonra veya çıkış yaptığınızda silinir. Tarayıcıdan okunamaz (HttpOnly).",
          "Tema tercihi (tarayıcı yerel depolaması): Aydınlık veya karanlık modu seçtiyseniz tercihinizi hatırlamak için tutulur. Sunucuya gönderilmez.",
          "Müşteri sayfası: Adınız ve telefonunuz, sonraki randevuda formu kolayca doldurmanız için yalnızca sizin tarayıcınızda saklanır. Sunucuya yalnızca randevu aldığınızda gönderilir.",
        ],
        p: [
          "Bu kayıtlar sitenin çalışması ve istediğiniz hizmetin sunulması için zorunludur; bu nedenle ayrıca onay istenmez. Tarayıcı ayarlarından dilediğiniz zaman silebilirsiniz; silinirse giriş yapmanız ve tercihlerinizi yeniden seçmeniz gerekir.",
        ],
      },
      { h: "Sorularınız için", ul: [`E-posta: ${COMPANY.email}`] },
    ],
  },
];

export const getLegalDoc = (slug: string) => LEGAL_DOCS.find((d) => d.slug === slug);
