import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';

const qaData = [
  {
    id: 1,
    thQ: "อาหารของร้านเป็นแนวไหน?",
    thA: "ตอบ: \"จริตจัด รสชัดเจน\" ครับ พระเอกของร้านคืออาหารใต้ที่นำมาจับแต่งตัวใหม่ ให้หน้าตาทันสมัยแต่รสชาติยังคงความเข้มข้นถึงพริกถึงเครื่อง รับรองว่า \"หรอย\" แน่นอน! นอกจากนี้เรายังมีกลิ่นอายของอาหารอีสานและญี่ปุ่นผสมผสานอยู่เล็กน้อย โดยมีเสิร์ฟทั้งแบบข้าวหน้าจานเดียวทานง่าย และแบบกับข้าวสำหรับแชร์ความอร่อยกัน ไม่ว่าจะเป็นเมนูซอสสไตล์ญี่ปุ่น ไปจนถึงเครื่องดื่มอย่าง Mocktail และ Cocktail เราก็ปรับรสชาติและดึง \"จริต\" ให้มีความจัดจ้าน ชัดเจน ถูกปากคุ้นลิ้นคนไทยทุกเมนูครับ",
    enQ: "What kind of food do you serve?",
    enA: "A: \"Bold Attitude, Clear Taste.\" Our highlight is Southern Thai food with a modern twist, keeping the authentic, intense flavors—guaranteed to be \"Roi\" (absolutely delicious)! We also blend in subtle hints of Isan and Japanese cuisines. We serve both convenient single-dish rice bowls and sharing plates. Even our Japanese-style sauces, mocktails, and cocktails are specially crafted with bold, distinct flavors that perfectly suit the Thai palate."
  },
  {
    id: 2,
    thQ: "มีค่าเปิดเครื่องดื่มแอลกอฮอล์ไหม?",
    thA: "ตอบ: มีครับ ทางร้านมีค่าเปิดเริ่มต้นที่ 100 บาทครับ",
    enQ: "Is there a corkage fee for alcohol?",
    enA: "A: Yes, we have a corkage fee starting at 100 THB."
  },
  {
    id: 3,
    thQ: "มีที่จอดรถไหม?",
    thA: "ตอบ: ลูกค้าสามารถจอดรถได้สะดวกสบายบริเวณริมโขง และในซอยพนมพนารักษ์ครับ",
    enQ: "Is parking available?",
    enA: "A: Yes, you can conveniently park along the Mekong riverfront or in Soi Phanom Phanarak."
  },
  {
    id: 4,
    thQ: "จองโต๊ะมีค่ามัดจำไหม?",
    thA: "ตอบ: มีค่ามัดจำในการจองขั้นต่ำคนละ 300 บาทครับ (แต่ไม่ต้องห่วงนะครับ หากทานอาหารและเครื่องดื่มไม่ถึงยอดมัดจำ ทางร้านยินดีคืนเงินส่วนต่างให้ครับ)",
    enQ: "Is a deposit required for reservations?",
    enA: "A: Yes, there is a minimum deposit of 300 THB per person. (Don't worry—if your total bill is less than the deposit, we will refund the difference!)"
  },
  {
    id: 5,
    thQ: "นำสัตว์เลี้ยงเข้าร้านได้ไหม?",
    thA: "ตอบ: ยินดีต้อนรับน้องๆ ครับ แต่เพื่อความเรียบร้อยและเพื่อความสบายใจของลูกค้าทุกท่าน รบกวนให้น้องๆ อยู่ในตะกร้า กระเป๋า หรือรถเข็นสำหรับสัตว์เลี้ยงนะครับ",
    enQ: "Are pets allowed?",
    enA: "A: Pets are very welcome! However, for the comfort of all our guests, we kindly ask that your furry friends stay inside a pet basket, carrier, or stroller."
  },
  {
    id: 6,
    thQ: "สามารถฝากเค้ก ดอกไม้ หรืออื่นๆ สำหรับโอกาสพิเศษได้ไหม?",
    thA: "ตอบ: ได้เลยครับ! ยินดีมากๆ สามารถนำเค้กมาฝากแช่ตู้เย็น หรือฝากของเซอร์ไพรส์ไว้กับพนักงานได้เลย แอบกระซิบแจ้งเราล่วงหน้าได้ครับ",
    enQ: "Can I bring a cake or flowers for a special occasion?",
    enA: "A: Absolutely! You are more than welcome to bring a cake to store in our fridge or leave surprise gifts with our staff. Just let us know in advance!"
  },
  {
    id: 7,
    thQ: "ร้านเปิด-ปิดกี่โมง?",
    thA: "ตอบ: เปิดให้บริการทุกวัน ตั้งแต่เวลา 11:30 - 23:30 น. ครับ แวะมาฝากท้องได้ทั้งมื้อเที่ยงยาวไปจนถึงมื้อดึกเลยครับ",
    enQ: "What are your opening hours?",
    enA: "A: We are open every day from 11:30 AM to 11:30 PM. Feel free to drop by for lunch all the way through to late-night dining."
  },
  {
    id: 8,
    thQ: "ต้องจองโต๊ะล่วงหน้าไหม หรือ Walk-in ได้เลย?",
    thA: "ตอบ: สามารถ Walk-in เข้ามาได้เลยครับ แต่ถ้าเป็นช่วงเย็น วันหยุด หรือมากันหลายคน แนะนำให้จองโต๊ะล่วงหน้าจะได้มุมที่นั่งถูกใจและพร้อมให้บริการที่สุดครับ",
    enQ: "Do I need to book in advance or are walk-ins welcome?",
    enA: "A: Walk-ins are always welcome! However, if you plan to visit during the evening, on weekends, or with a group, we highly recommend booking in advance to secure your favorite spot."
  },
  {
    id: 9,
    thQ: "รับจัดเลี้ยง หรือมีโต๊ะสำหรับกลุ่มใหญ่ไหม?",
    thA: "ตอบ: รับครับ ทางร้านสามารถจัดสรรพื้นที่และต่อโต๊ะสำหรับกลุ่มใหญ่ได้ รบกวนติดต่อจองล่วงหน้าเพื่อให้ทางเราได้เตรียมการต้อนรับอย่างดีที่สุดครับ",
    enQ: "Do you accommodate large groups or private parties?",
    enA: "A: Yes, we do! We can arrange our space and combine tables for large groups. Please contact us in advance so we can prepare the best experience for you."
  },
  {
    id: 10,
    thQ: "รับชำระเงินช่องทางไหนบ้าง?",
    thA: "ตอบ: ทางร้านรับชำระผ่านเงินสด และสแกนจ่าย (QR Code) ครับ (ต้องขออภัยด้วยนะครับ ปัจจุบันทางร้านยังไม่รองรับการชำระด้วยบัตรเครดิตครับ)",
    enQ: "What payment methods do you accept?",
    enA: "A: We accept Cash and Thai QR Code scanning. (We apologize for any inconvenience, but we currently do not accept credit cards.)"
  }
];

const QnAItem = ({ item }) => {
  return (
    <section className="w-full min-h-screen flex items-center justify-center p-6 md:p-12 lg:p-24 snap-start snap-always relative overflow-hidden">
      <div className="w-full max-w-4xl mx-auto flex flex-col justify-center space-y-12 md:space-y-16 z-10">
        
        {/* Decorative elements */}
        {item.id === 1 && (
            <motion.div 
                initial={{ opacity: 0, rotate: -20, scale: 0.8 }}
                whileInView={{ opacity: 1, rotate: -10, scale: 1 }}
                viewport={{ once: false }}
                transition={{ duration: 0.8, type: "spring" }}
                className="absolute top-12 right-4 md:top-24 md:right-16 text-[#DFFF00] font-black text-3xl md:text-6xl leading-none font-['Space_Mono'] drop-shadow-lg z-0 opacity-20 md:opacity-80 pointer-events-none"
                style={{ WebkitTextStroke: '2px #1A1A1A' }}
            >
                <div>MADE!</div>
                <div>IT BOLD</div>
                <div className="text-sm md:text-2xl mt-1 text-center bg-[#1A1A1A] text-[#DFFF00] rounded-full w-8 h-8 md:w-12 md:h-12 flex items-center justify-center ml-auto border-[2px] md:border-4 border-[#DFFF00]">TH</div>
            </motion.div>
        )}

        {/* Thai Section */}
        <motion.div 
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, margin: "-10%" }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col space-y-4 md:space-y-6"
        >
          <h2 className="text-3xl md:text-5xl lg:text-6xl font-['Prompt'] font-semibold text-[#1A1A1A] leading-tight tracking-tight max-w-2xl">
            {item.thQ}
          </h2>
          <p className="text-lg md:text-xl font-['Prompt'] text-white leading-relaxed font-light tracking-wide md:max-w-3xl">
            {item.thA}
          </p>
        </motion.div>

        {/* English Section */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, margin: "-10%" }}
          transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col space-y-4 md:space-y-6"
        >
          <h2 className="text-3xl md:text-5xl lg:text-6xl font-['Space_Mono'] font-bold text-[#1A1A1A] leading-tight tracking-tighter max-w-2xl uppercase">
            {item.enQ}
          </h2>
          <p className="text-lg md:text-xl font-['Space_Mono'] text-white leading-relaxed font-normal tracking-tight md:max-w-3xl">
            {item.enA}
          </p>
        </motion.div>

      </div>
    </section>
  );
};

export default function QnAPage() {
  const containerRef = useRef(null);

  return (
    <div 
      className="w-full h-screen bg-[#636AA0] overflow-y-auto snap-y snap-mandatory no-scrollbar relative"
      ref={containerRef}
    >
      {/* Fixed Header */}
      <motion.header 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.5 }}
        className="fixed top-0 left-0 w-full p-6 md:p-10 flex justify-between items-start z-50 pointer-events-none mix-blend-difference text-white font-['Space_Mono'] text-sm tracking-widest uppercase"
      >
        <div>#LOCAL</div>
        <div>Q&A ถาม-ตอบ</div>
      </motion.header>

      {/* Content */}
      <div className="w-full">
        {qaData.map((item) => (
          <QnAItem key={item.id} item={item} />
        ))}
      </div>

      {/* Fixed Footer */}
      <motion.footer 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.5 }}
        className="fixed bottom-0 left-0 w-full p-6 md:p-10 flex justify-between items-end z-50 pointer-events-none mix-blend-difference text-white font-['Space_Mono'] text-sm tracking-widest uppercase"
      >
        <div className="hidden md:block">#LOCAL</div>
        <div>ORIGINS</div>
        <div>BOLD</div>
      </motion.footer>

      {/* Scroll indicator overlay */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2, duration: 1 }}
        className="fixed bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-40 pointer-events-none mix-blend-difference opacity-50"
      >
        <span className="text-[10px] text-white font-['Space_Mono'] tracking-widest uppercase">Scroll</span>
        <motion.div 
            animate={{ y: [0, 8, 0] }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
            className="w-px h-8 bg-white"
        />
      </motion.div>
    </div>
  );
}
