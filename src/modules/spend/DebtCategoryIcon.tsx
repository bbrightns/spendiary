import type { DebtCategory } from '../../lib/types'
import { CarIcon, CreditCardIcon, DebtIcon, HomeIcon, ReceiptPercentIcon, ShoppingBagIcon } from '../../components/icons'

/** Icon for a loan or installment by its category. */
export function DebtCategoryIcon({ category, className = 'h-4 w-4' }: { category: DebtCategory; className?: string }) {
  switch (category) {
    case 'installment':
      return <ShoppingBagIcon className={className} />
    case 'credit_card':
      return <CreditCardIcon className={className} />
    case 'mortgage':
      return <HomeIcon className={className} />
    case 'auto_loan':
      return <CarIcon className={className} />
    case 'personal_loan':
    case 'student_loan':
      return <ReceiptPercentIcon className={className} />
    default:
      return <DebtIcon className={className} />
  }
}
