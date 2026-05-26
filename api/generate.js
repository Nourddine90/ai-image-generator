export default async function handler(req, res) {
    // تحديد الكورسات (CORS) للسماح بالطلبات
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // معالجة طلب preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    // السماح فقط لطلبات POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'الطريقة غير مسموحة. استخدم POST' });
    }
    
    const { prompt } = req.body;
    
    if (!prompt || prompt.trim() === '') {
        return res.status(400).json({ error: 'الرجاء إدخال وصف الصورة' });
    }
    
    // التوكن يُقرأ من متغيرات البيئة في Vercel (آمن تماماً)
    const HF_TOKEN = process.env.HF_TOKEN;
    
    if (!HF_TOKEN) {
        console.error('HF_TOKEN غير موجود في متغيرات البيئة');
        return res.status(500).json({ error: 'خطأ في تكوين الخادم: التوكن غير موجود' });
    }
    
    try {
        console.log('جاري الاتصال بـ Hugging Face API...');
        
        const response = await fetch(
            'https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-2-1',
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${HF_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    inputs: prompt,
                    parameters: {
                        negative_prompt: "blurry, bad anatomy, distorted, low quality",
                        num_inference_steps: 25
                    }
                })
            }
        );
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Hugging Face API خطأ ${response.status}:`, errorText);
            
            if (response.status === 401) {
                return res.status(401).json({ error: 'رمز التفويض غير صالح. تأكد من إعداد HF_TOKEN في Vercel' });
            } else if (response.status === 429) {
                return res.status(429).json({ error: 'تجاوزت الحد المجاني اليومي. حاول مرة أخرى غداً' });
            } else if (response.status === 503) {
                return res.status(503).json({ error: 'النموذج قيد التحميل. انتظر دقيقة وحاول مرة أخرى' });
            }
            
            return res.status(response.status).json({ error: `خطأ من Hugging Face: ${response.status}` });
        }
        
        // تحويل الصورة إلى base64
        const imageBuffer = await response.arrayBuffer();
        const base64Image = Buffer.from(imageBuffer).toString('base64');
        
        return res.status(200).json({ 
            success: true, 
            image: `data:image/png;base64,${base64Image}` 
        });
        
    } catch (error) {
        console.error('خطأ في الخادم:', error);
        return res.status(500).json({ error: 'حدث خطأ داخلي في الخادم. حاول مرة أخرى' });
    }
}
