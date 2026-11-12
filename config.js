// Makas AI site ayarları. Yayına almadan önce bu dosyayı doldurun.
window.MAKAS = {
  // Lisans sunucusunun adresi (Cloudflare Worker). Boşsa hesap sayfaları "yakında" kipinde çalışır.
  API: 'https://makas-lisans.thepeassa.workers.dev',
  // Fiyatlar: yalnızca gösterim içindir; gerçek tutarı ödeme sağlayıcısı (Paddle) belirler.
  PRICES: {
    currency: '$',
    monthly: 12, // aylık plan, ay başına
    yearly: 96, // yıllık plan, yıl başına
  },
  // Kurulum dosyaları (hesap sayfasındaki indirme düğmeleri)
  DOWNLOADS: { mac: 'download/Makas-0.1.0.zip', win: 'download/Makas-0.1.0.zip' },
};
