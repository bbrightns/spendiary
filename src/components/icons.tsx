/**
 * The app's icons. They come from Lucide (lucide-react, pinned in package.json) with the app's line
 * weight; the names below stay the same, so screens import them as before.
 */
import {
  ArrowDownRight as LArrowDownRight, ArrowLeftRight, ArrowUpRight as LArrowUpRight, Bell, Calendar, CalendarSync, Car,
  ChartPie, Check, ChevronDown, ChevronLeft, ChevronRight, CircleCheck, CircleHelp, Clock, Coins, Command, Copy,
  CreditCard, Database, Download, Ellipsis, FlaskConical, HandCoins, House, Info, Keyboard, Layers, LayoutGrid, List,
  Lock, LockOpen, LogOut, Minus, Pencil, Plus, Receipt, ReceiptText, Scale, Search, Settings, ShoppingBag, Sparkle,
  Sparkles, Table, Tag, Target, Trash2, TreePalm, TrendingUp, TriangleAlert, Undo, Upload, Wallet, X,
  ArrowDown, ArrowDownToLine, ArrowUp, Banknote, Gift, Hourglass, Landmark, Lightbulb, Package, Star, TrendingDown,
} from 'lucide-react'
import { appIcon } from './appIcon'

// Navigation
export const DashboardIcon = appIcon(LayoutGrid, 'DashboardIcon')
export const PortfolioIcon = appIcon(TrendingUp, 'PortfolioIcon')
export const DcaIcon = appIcon(CalendarSync, 'DcaIcon')
export const CashflowIcon = appIcon(ArrowLeftRight, 'CashflowIcon')
export const DividendIcon = appIcon(HandCoins, 'DividendIcon')
export const StrategyIcon = appIcon(Layers, 'StrategyIcon')
export const RetirementIcon = appIcon(TreePalm, 'RetirementIcon')
export const DebtIcon = appIcon(Receipt, 'DebtIcon')
export const PieChartIcon = appIcon(ChartPie, 'PieChartIcon')

// Money
export const WalletIcon = appIcon(Wallet, 'WalletIcon')
export const CoinsIcon = appIcon(Coins, 'CoinsIcon')
export const CreditCardIcon = appIcon(CreditCard, 'CreditCardIcon')
export const ReceiptPercentIcon = appIcon(ReceiptText, 'ReceiptPercentIcon')
export const ArrowUpRight = appIcon(LArrowUpRight, 'ArrowUpRight')
export const ArrowDownRight = appIcon(LArrowDownRight, 'ArrowDownRight')
export const ArrowUpRightIcon = appIcon(LArrowUpRight, 'ArrowUpRightIcon')

// Actions
export const PlusIcon = appIcon(Plus, 'PlusIcon')
export const MinusIcon = appIcon(Minus, 'MinusIcon')
export const CheckIcon = appIcon(Check, 'CheckIcon')
export const CheckCircleIcon = appIcon(CircleCheck, 'CheckCircleIcon')
export const PencilIcon = appIcon(Pencil, 'PencilIcon')
export const TrashIcon = appIcon(Trash2, 'TrashIcon')
export const CloseIcon = appIcon(X, 'CloseIcon')
export const CopyIcon = appIcon(Copy, 'CopyIcon')
export const UndoIcon = appIcon(Undo, 'UndoIcon')
export const DownloadIcon = appIcon(Download, 'DownloadIcon')
export const UploadIcon = appIcon(Upload, 'UploadIcon')
export const SearchIcon = appIcon(Search, 'SearchIcon')
export const LogOutIcon = appIcon(LogOut, 'LogOutIcon')
export const LockClosedIcon = appIcon(Lock, 'LockClosedIcon')
export const LockOpenIcon = appIcon(LockOpen, 'LockOpenIcon')
export const DotsHorizontalIcon = appIcon(Ellipsis, 'DotsHorizontalIcon')
export const ChevronDownIcon = appIcon(ChevronDown, 'ChevronDownIcon')
export const ChevronRightIcon = appIcon(ChevronRight, 'ChevronRightIcon')
export const ChevronLeftIcon = appIcon(ChevronLeft, 'ChevronLeftIcon')

// Status & misc
export const ClockIcon = appIcon(Clock, 'ClockIcon')
export const AlertIcon = appIcon(TriangleAlert, 'AlertIcon')
export const HelpCircleIcon = appIcon(CircleHelp, 'HelpCircleIcon')
export const SettingsIcon = appIcon(Settings, 'SettingsIcon')
export const ScaleIcon = appIcon(Scale, 'ScaleIcon')
export const TableIcon = appIcon(Table, 'TableIcon')
export const ListIcon = appIcon(List, 'ListIcon')
export const GroupIcon = appIcon(Layers, 'GroupIcon')
export const HomeIcon = appIcon(House, 'HomeIcon')
export const CarIcon = appIcon(Car, 'CarIcon')
export const ShoppingBagIcon = appIcon(ShoppingBag, 'ShoppingBagIcon')
export const FlaskIcon = appIcon(FlaskConical, 'FlaskIcon')
export const CommandIcon = appIcon(Command, 'CommandIcon')
export const KeyboardIcon = appIcon(Keyboard, 'KeyboardIcon')
export const CalendarIcon = appIcon(Calendar, 'CalendarIcon')
export const TargetIcon = appIcon(Target, 'TargetIcon')
export const TagIcon = appIcon(Tag, 'TagIcon')
export const BellIcon = appIcon(Bell, 'BellIcon')
export const DatabaseIcon = appIcon(Database, 'DatabaseIcon')
export const InfoIcon = appIcon(Info, 'InfoIcon')
/** The four-point star with a small cross (AI, highlights) */
export const SparkleIcon = appIcon(Sparkles, 'SparkleIcon')
/** A single four-point star */
export const SparklesIcon = appIcon(Sparkle, 'SparklesIcon')

// Activity and money events (these replace emoji in labels: the interface uses icons only)
export const ArrowUpIcon = appIcon(ArrowUp, 'ArrowUpIcon')
export const ArrowDownIcon = appIcon(ArrowDown, 'ArrowDownIcon')
export const ArrivedIcon = appIcon(ArrowDownToLine, 'ArrivedIcon')
export const MoveIcon = appIcon(ArrowLeftRight, 'MoveIcon')
export const GiftIcon = appIcon(Gift, 'GiftIcon')
export const BanknoteIcon = appIcon(Banknote, 'BanknoteIcon')
export const PackageIcon = appIcon(Package, 'PackageIcon')
export const LandmarkIcon = appIcon(Landmark, 'LandmarkIcon')
export const TrendUpIcon = appIcon(TrendingUp, 'TrendUpIcon')
export const TrendDownIcon = appIcon(TrendingDown, 'TrendDownIcon')
export const LightbulbIcon = appIcon(Lightbulb, 'LightbulbIcon')
export const HourglassIcon = appIcon(Hourglass, 'HourglassIcon')
export const StarIcon = appIcon(Star, 'StarIcon')
