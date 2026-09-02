export interface TourStep {
  targetId: string
  title: string
  description: string
  badge?: string
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center'
}

export type PageGuideKey =
  | 'dashboard'
  | 'portfolio'
  | 'dca'
  | 'rebalance'
  | 'retirement'
  | 'logs'
  | 'settings'

export const PAGE_GUIDES: Record<PageGuideKey, { title: string; steps: TourStep[] }> = {
  dashboard: {
    title: 'แนะนำหน้าภาพรวม (Dashboard)',
    steps: [
      {
        targetId: 'guide-dashboard-networth',
        badge: 'ภาพรวมพอร์ต',
        title: 'มูลค่าความมั่งคั่งสุทธิ (Net Worth)',
        description:
          'แสดงยอดรวมของเงินสดในทุกบัญชีและมูลค่าสินทรัพย์ลงทุนทั้งหมดของคุณ คำนวณแปลงเป็นเงินบาท (THB) ให้แบบอัตโนมัติ',
        position: 'bottom',
      },
      {
        targetId: 'guide-dashboard-dca',
        badge: 'รอบลงทุนวันนี้',
        title: 'แจ้งเตือน DCA ประจำรอบ (DCA Alerts)',
        description:
          'เมื่อถึงรอบวันที่คุณวางแผน DCA ไว้ ระบบจะแสดงรายการเตือนที่นี่ ให้คุณกด "บันทึกซื้อ" เข้าพอร์ตได้สะดวกรวดเร็ว',
        position: 'bottom',
      },
      {
        targetId: 'guide-dashboard-alloc',
        badge: 'กระจายความเสี่ยง',
        title: 'สัดส่วนสินทรัพย์ (Asset Allocation)',
        description:
          'กราฟแสดงสัดส่วนการลงทุนตามประเภทสินทรัพย์ เช่น หุ้น, กองทุนรวม, คริปโตเคอร์เรนซี และทองคำ เพื่อตรวจสอบความสมดุล',
        position: 'top',
      },
      {
        targetId: 'guide-dashboard-cash',
        badge: 'เงินสดสำรอง',
        title: 'บัญชีเงินสด & สภาพคล่อง (Cash Accounts)',
        description:
          'จัดการบัญชีเงินฝาก บัญชีออมทรัพย์ดอกเบี้ยสูง หรือเงินสดสำรอง พร้อมกดแก้ไขยอดเงินหรือเพิ่มบัญชีใหม่ได้ทันที',
        position: 'bottom',
      },
      {
        targetId: 'guide-dashboard-chart',
        badge: 'แนวโน้มการเติบโต',
        title: 'กราฟแนวโน้มความมั่งคั่ง (Net Worth Trend)',
        description:
          'บันทึกและพล็อตประวัติการเติบโตของความมั่งคั่งสุทธิย้อนหลัง ช่วยให้เห็นทิศทางและพัฒนาการทางการเงินของคุณ',
        position: 'top',
      },
    ],
  },

  portfolio: {
    title: 'แนะนำหน้าพอร์ตการลงทุน (Portfolio)',
    steps: [
      {
        targetId: 'guide-portfolio-summary',
        badge: 'สรุปผลตอบแทน',
        title: 'ผลตอบแทนรวมของพอร์ต (Portfolio PnL)',
        description:
          'ดูมูลค่าตลาดปัจจุบัน (Market Value), ยอดเงินลงทุนตั้งต้น (Total Cost) และกำไร/ขาดทุนที่ยังไม่รับรู้ (Unrealized PnL) ทั้งแบบบาทและ %',
        position: 'bottom',
      },
      {
        targetId: 'guide-portfolio-actions',
        badge: 'เครื่องมือจัดการ',
        title: 'ส่งออกข้อมูลพอร์ต (Export & Actions)',
        description:
          'คัดลอกสรุปพอร์ตทั้งหมดในรูปแบบ Markdown เพื่อนำไปใช้วิเคราะห์ต่อ หรือกดรีเฟรชราคาตลาดสดแบบ Real-time',
        position: 'bottom',
      },
      {
        targetId: 'guide-portfolio-alloc',
        badge: 'สัดส่วนสินทรัพย์',
        title: 'การกระจายพอร์ต (Asset Allocation)',
        description:
          'กราฟ Donut แสดงสัดส่วนมูลค่าและกำไรขาดทุนแยกตามกลุ่มสินทรัพย์ พร้อมปุ่มลัดไปยังหน้า Rebalance',
        position: 'bottom',
      },
      {
        targetId: 'guide-portfolio-holdings',
        badge: 'สินทรัพย์รายตัว',
        title: 'รายการสินทรัพย์ในพอร์ต (Holdings)',
        description:
          'รายการสินทรัพย์ของคุณพร้อมต้นทุนเฉลี่ยและราคาตลาด คุณสามารถคลิกเพื่อบันทึกการซื้อเพิ่ม, โยกย้าย หรือดูประวัติธุรกรรมย้อนหลังได้',
        position: 'top',
      },
      {
        targetId: 'guide-portfolio-tabs',
        badge: 'แยกหมวดหมู่',
        title: 'ตัวกรองประเภทสินทรัพย์ (Asset Tabs)',
        description:
          'สลับแท็บเพื่อดูสินทรัพย์เฉพาะกลุ่ม เช่น หุ้นรายตัว, กองทุนรวม, คริปโต หรือทองคำ พร้อมแสดงสัดส่วนของแต่ละกลุ่ม',
        position: 'bottom',
      },
    ],
  },

  dca: {
    title: 'แนะนำหน้าวางแผน DCA (DCA Planner)',
    steps: [
      {
        targetId: 'guide-dca-summary',
        badge: 'งบประมาณลงทุน',
        title: 'ยอดเงินเดือนและงบประมาณ (Cashflow & Budget)',
        description:
          'สรุปรายได้ประจำและแถบสัดส่วนงบประมาณ ช่วยวางแผนและจัดสรรเงินออมเพื่อการลงทุนอย่างมีวินัย',
        position: 'bottom',
      },
      {
        targetId: 'guide-dca-transfers',
        badge: 'ค่าใช้จ่ายคงที่',
        title: 'รายการค่าใช้จ่ายประจำ (Fixed Costs)',
        description:
          'บันทึกค่าใช้จ่ายคงที่รายเดือน เช่น ค่าเช่า ค่าน้ำ-ไฟ หรือเงินที่ต้องกันไว้ เพื่อให้เห็นเงินสุทธิที่เหลือสำหรับการลงทุน',
        position: 'top',
      },
      {
        targetId: 'guide-dca-plans',
        badge: 'แผนรายเดือน',
        title: 'แผนการลงทุนประจำรอบ (DCA Plans)',
        description:
          'กำหนดสินทรัพย์ที่ต้องการสะสม ระบุวันที่ต้องการซื้อของแต่ละเดือน จำนวนเงิน และบัญชีเงินสดต้นทางที่จะใช้ตัดเงิน',
        position: 'bottom',
      },
      {
        targetId: 'guide-dca-confirm',
        badge: 'บันทึกอัตโนมัติ',
        title: 'ยืนยันการซื้อจริงเข้าพอร์ต (Confirm DCA Buy)',
        description:
          'เมื่อถึงกำหนดวันที่ตั้งไว้ ระบบจะไฮไลต์ให้กดยืนยัน โดยจะตัดยอดเงินสดและคำนวณจำนวนหน่วยเข้าพอร์ตให้ทันทีโดยไม่ต้องคำนวณเอง',
        position: 'top',
      },
    ],
  },

  rebalance: {
    title: 'แนะนำหน้าปรับสมดุลพอร์ต (Rebalance)',
    steps: [
      {
        targetId: 'guide-rebalance-mode',
        badge: 'เลือกรูปแบบ',
        title: 'โหมดปรับสมดุลพอร์ต (Rebalancing Mode)',
        description:
          'สามารถเลือกปรับสมดุลตาม "กลุ่มสินทรัพย์" (Asset Class) เช่น หุ้น 50% กองทุน 30% หรือปรับตาม "รายตัวสินทรัพย์" (Holdings) ได้ตามต้องการ',
        position: 'bottom',
      },
      {
        targetId: 'guide-rebalance-cash',
        badge: 'เงินเติมใหม่',
        title: 'จำลองการเติมเงินสด (Cash Injection)',
        description:
          'ใส่จำนวนเงินสดที่คุณต้องการเติมเพิ่มเข้าไปในพอร์ต ระบบจะช่วยวางแผนซื้อสินทรัพย์ที่สัดส่วนยังขาดอยู่ โดยที่คุณไม่ต้องขายสินทรัพย์เดิม',
        position: 'top',
      },
      {
        targetId: 'guide-rebalance-weights',
        badge: 'กำหนดเป้าหมาย',
        title: 'สัดส่วนเป้าหมาย (Target Allocation)',
        description:
          'ปรับเปอร์เซ็นต์สัดส่วนที่คุณต้องการให้ครบ 100% เพื่อใช้เป็นเกณฑ์ในการเปรียบเทียบกับพอร์ตปัจจุบัน',
        position: 'bottom',
      },
      {
        targetId: 'guide-rebalance-suggestions',
        badge: 'แผนการซื้อ/ขาย',
        title: 'คำแนะนำการปรับพอร์ต (Action Suggestions)',
        description:
          'ระบบคำนวณส่วนต่างให้เห็นชัดเจนว่าต้อง "ซื้อเพิ่ม" หรือ "ขายออก" เท่าไหร่ในแต่ละรายการ เพื่อให้พอร์ตกลับมาสมดุลตามเป้าหมายที่สุด',
        position: 'top',
      },
    ],
  },

  retirement: {
    title: 'แนะนำหน้าแผนเกษียณ (Retirement & FIRE)',
    steps: [
      {
        targetId: 'guide-retirement-settings',
        badge: 'ตั้งเป้าหมาย',
        title: 'ข้อมูลและเป้าหมายเกษียณ (FIRE Parameters)',
        description:
          'กรอกอายุปัจจุบัน, อายุเป้าหมายที่ต้องการเกษียณ, ประมาณการผลตอบแทนการลงทุน และค่าใช้จ่ายที่ต้องการใช้ต่อเดือนหลังเกษียณ',
        position: 'bottom',
      },
      {
        targetId: 'guide-retirement-chart',
        badge: 'เส้นทางสู่อนาคต',
        title: 'กราฟจำลองการสะสมความมั่งคั่ง (Wealth Simulation)',
        description:
          'กราฟจำลองการเติบโตของพอร์ตจากเงินต้นและการลงทุนสม่ำเสมอ เทียบกับเป้าหมายอิสรภาพทางการเงินจนถึงวัยเกษียณ',
        position: 'bottom',
      },
      {
        targetId: 'guide-retirement-freedom',
        badge: 'อิสรภาพการเงิน',
        title: 'เงินสำรอง & ก้าวสำคัญ (Runway & Milestones)',
        description:
          'ประเมินความอยู่รอดทางการเงินและระดับอิสรภาพ (Coast FI, Lean FI, Full FI) เทียบกับทรัพย์สินที่มีอยู่จริงในปัจจุบัน',
        position: 'top',
      },
    ],
  },

  logs: {
    title: 'แนะนำหน้าประวัติธุรกรรม (Holding Logs)',
    steps: [
      {
        targetId: 'guide-logs-header',
        badge: 'ตัวกรองประวัติ',
        title: 'ตัวกรองธุรกรรมพอร์ต (Filter Actions)',
        description:
          'กรองดูเฉพาะกลุ่มสินทรัพย์ หรือประเภทกิจกรรม เช่น ซื้อเพิ่ม, อัปเดตราคา, แก้ไขข้อมูล ได้อย่างสะดวก',
        position: 'bottom',
      },
      {
        targetId: 'guide-logs-list',
        badge: 'รายละเอียด',
        title: 'รายการบันทึกย้อนหลัง (Activity Timeline)',
        description:
          'ตรวจสอบวันที่ทำรายการ, ราคาต้นทุน, จำนวนหน่วย, และประวัติการเปลี่ยนแปลง พร้อมปุ่ม Undo เพื่อยกเลิกรายการได้ทุกเมื่อ',
        position: 'top',
      },
    ],
  },

  settings: {
    title: 'แนะนำหน้าตั้งค่า (Settings)',
    steps: [
      {
        targetId: 'guide-settings-sync',
        badge: 'เชื่อมต่อคลาวด์',
        title: 'การซิงค์ข้อมูลผ่าน Cloud (Supabase)',
        description:
          'ล็อกอินด้วย Google Account เพื่อซิงค์ข้อมูลส่วนตัวบน Supabase Cloud ทำให้สามารถใช้งานร่วมกันได้ทุกเครื่องอย่างปลอดภัย',
        position: 'bottom',
      },
      {
        targetId: 'guide-settings-profile',
        badge: 'โปรไฟล์',
        title: 'ข้อมูลผู้ใช้งาน (Profile)',
        description:
          'ตั้งชื่อของคุณสำหรับแสดงข้อความทักทายในหน้า Dashboard และการระบุตัวตนบนเครื่องนี้',
        position: 'bottom',
      },
      {
        targetId: 'guide-settings-backup',
        badge: 'ความปลอดภัยข้อมูล',
        title: 'สำรองและนำเข้าข้อมูล (Backup & Restore)',
        description:
          'ส่งออกไฟล์สำรองข้อมูล JSON เก็บไว้ หรือนำเข้าไฟล์เดิมเพื่อย้ายเครื่องหรือกู้คืนข้อมูลได้ตลอดเวลา',
        position: 'bottom',
      },
      {
        targetId: 'guide-settings-tour',
        badge: 'คู่มือใช้งาน',
        title: 'คู่มือการใช้งาน (Tour Guides)',
        description:
          'คุณสามารถกดปุ่ม "แนะนำหน้านี้" ที่อยู่ด้านบนของแต่ละหน้าเพื่อดูคำแนะนำการใช้งานแบบทีละขั้นตอนได้ตลอดเวลา',
        position: 'top',
      },
    ],
  },
}

