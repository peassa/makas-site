// Makas AI site ayarları. Yayına almadan önce bu dosyayı doldurun.
window.MAKAS = {
  // Lisans sunucusunun adresi (Cloudflare Worker). Boşsa hesap sayfaları "yakında" kipinde çalışır.
  API: 'https://makas-lisans.thepeassa.workers.dev',
  // Fiyatlar: yalnızca gösterim içindir; gerçek tutarı ödeme sağlayıcısı (Paddle) belirler.
  PRICES: {
    currency: '$',
    monthly: 6, // aylık plan, ay başına
    yearly: 48, // yıllık plan, yıl başına
  },
  // Kayıt kipi sunucudan okunur (yönetici paneli > Kayıtlar): 'acik' herkes, 'davet' davet koduyla, 'kapali' kimse.
  // Sunucu yanıt vermezse ya da eski sürümse bu değer geçerlidir. Kaydı yeniden kapatmak için 'kapali' yazın.
  SIGNUP: 'acik',
  // Kurulum dosyaları (hesap sayfasındaki indirme düğmeleri)
  // Mac: çift tıklanan kurulum uygulaması; Windows: kurulum dosyası zip içinde
  DOWNLOADS: { mac: 'download/Makas-Kurulum-Mac.zip', win: 'download/Makas-0.1.0.zip' },
};
