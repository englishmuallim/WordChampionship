require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let isHybridMode = false;

// Supabase Bağlantısı
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// 1. ANA SAYFAYI LOGIN'E YÖNLENDİR
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// 2. LOGIN API (KİMLİK KONTROLÜ)
app.post('/api/login', async (req, res) => {
    // trim() ile kazara girilen boşlukları siliyoruz
    const username = req.body.username.trim();
    const password = req.body.password.trim();

    console.log(`Giriş denemesi: Kullanıcı=${username}, Şifre=${password}`);

    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('username', username)
            .eq('password', password)
            .single();

        // Eğer Supabase bir hata döndürdüyse bunu terminalde görelim
        if (error) {
            console.log("Supabase'den Gelen Hata Detayı:", error);
        }

        if (error || !user) {
            return res.status(401).json({ message: 'Hatalı kullanıcı adı veya şifre!' });
        }

        console.log("Giriş Başarılı! Yönlendiriliyor...");
        const { password: _, ...userWithoutPassword } = user;
        res.json({ user: userWithoutPassword });

    } catch (err) {
        console.error("Sunucu tarafında beklenmeyen hata:", err);
        res.status(500).json({ message: 'Sunucu hatası oluştu.' });
    }
});

// Socket.io Bağlantısı
io.on('connection', (socket) => {
    console.log('Bir ekran bağlandı:', socket.id);
    socket.emit('hybrid_mode_status', isHybridMode);

    // Admin'den gelen komutlar (Turu başlat, ekranı temizle vb.)
    // Admin'den gelen komutları yöneten ana merkez
    socket.on('admin_command', async (data) => {
        console.log("Gelen Admin Komutu:", data.action);

        if (data.action === 'start_round') {
            try {
                const wordIdx = data.wordIndex || 1;
                const { data: word, error } = await supabase
                    .from('words')
                    .select('*')
                    .eq('round_no', data.round)
                    .eq('order_no', wordIdx)
                    .single();

                if (error || !word) {
                    console.log("Kelime bulunamadı, tur başlatılamadı.");
                    return;
                }

                data.wordData = word;
                io.emit('new_command', data);
            } catch (err) { console.error("Hata:", err); }
        }
        // TABLONA BİREBİR UYUMLU PUAN HESAPLAMA MANTIĞI
        else if (data.action === 'show_results') {
            console.log("Puanlar hesaplanıyor...");
            try {
                // 1. student_responses tablosundan DOĞRU cevapları çek (user_id ile)
                const { data: responses, error: respError } = await supabase
                    .from('student_responses')
                    .select('user_id')
                    .eq('is_correct', true);

                if (respError) throw respError;

                if (!responses || responses.length === 0) {
                    console.log("Hiç doğru cevap bulunamadı.");
                    io.emit('leaderboard_data', []);
                    return;
                }

                // 2. user_id'lere göre puanları (her doğru 10 puan) topla
                const scores = {};
                responses.forEach(r => {
                    const uid = r.user_id;
                    if (!scores[uid]) scores[uid] = { score: 0 };
                    scores[uid].score += 10;
                });

                // 3. Puan alan kullanıcıların bilgilerini users tablosundan çek
                const userIds = Object.keys(scores);
                const { data: usersData, error: usersError } = await supabase
                    .from('users')
                    .select('id, name, target_grades')
                    .in('id', userIds);

                if (usersError) throw usersError;

                // 4. İsimleri, sınıfları (target_grades) ve puanları birleştir
                usersData.forEach(u => {
                    if (scores[u.id]) {
                        scores[u.id].name = u.name;
                        scores[u.id].grade = u.target_grades;
                    }
                });

                // 5. Sırala ve sahneye gönder
                const leaderboard = Object.values(scores)
                    .filter(s => s.name)
                    .sort((a, b) => b.score - a.score)
                    .slice(0, 10);

                console.log("Sahneye gönderilen liste:", leaderboard);
                io.emit('leaderboard_data', leaderboard);

            } catch (err) {
                console.error("Puan hesaplama hatası:", err.message);
            }
        }
        // YENİ EKLENEN SIFIRLAMA KOMUTU
        else if (data.action === 'reset_scores') {
            console.log("Sıfırlama komutu alındı. Veritabanı temizleniyor...");
            try {
                // id'si 0'dan büyük olan her şeyi sil (Tabloyu tamamen boşaltır)
                const { error } = await supabase
                    .from('student_responses')
                    .delete()
                    .gt('id', 0);

                if (error) throw error;

                console.log("Tüm cevaplar başarıyla silindi.");
                io.emit('leaderboard_data', []); // Sahnede liderlik tablosu açıksa onu da boşalt
            } catch (err) {
                console.error("Sıfırlama hatası:", err.message);
            }
        }
        else if (data.action === 'toggle_hybrid') {
            isHybridMode = !isHybridMode;
            io.emit('hybrid_mode_status', isHybridMode);
        }
        else {
            io.emit('new_command', data);
        }
    });

    // YENİ: Öğrenciden gelen cevapları yakala ve Jüriye ilet
    socket.on('submit_answer', (data) => {
        console.log('Öğrenci Cevabı Geldi:', data);
        io.emit('student_answered', data);
    });

    // YENİ: Öğrenci sekme değiştirirse (Kopya şüphesi) Jüriyi uyar
    socket.on('focus_lost', (data) => {
        console.log('DİKKAT! Odak Kaybı:', data);
        io.emit('student_focus_lost', data);
    });
    // (server.js içindeki socket.on bloğuna ekle)

    // Jüriden gelen değerlendirmeyi (Doğru/Yanlış) veritabanına kaydet
    socket.on('save_evaluation', async (data) => {
        try {
            const { error } = await supabase
                .from('student_responses')
                .insert([{
                    user_id: data.user_id, // Eski sistemde data.student_id idi, düzeltildi!
                    round_no: data.round_no,
                    word_order: data.word_order,
                    given_answer: data.given_answer,
                    is_correct: data.is_correct
                }]);

            if (error) {
                console.error("Supabase Kayıt Hatası:", error.message);
            } else {
                console.log(`Değerlendirme kaydedildi: User ID ${data.user_id}, Sonuç: ${data.is_correct}`);
            }
        } catch (err) {
            console.error("Değerlendirme İşlem Hatası:", err.message);
        }
    });
    // Jürinin gerçek öğrenci listesini istemesi
    socket.on('request_students', async () => {
        try {
            const { data: students, error } = await supabase
                .from('users')
                .select('id, name, target_grades, role');

            if (students) {
                socket.emit('student_list', students);
            }
        } catch (err) {
            console.error("Öğrenci listesi çekilemedi:", err);
        }
    });
});

const PORT = process.env.PORT || 3002;
server.listen(PORT, () => {
    console.log(`Word Championship Sunucusu http://localhost:${PORT} adresinde aktif! 🏆`);
});