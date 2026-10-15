import {
  FileText, Upload, File, ClipboardList, Sparkles, Target, Download, Trash2,
  GripVertical, Eye, EyeOff, Plus, X, Check, ChevronUp, ChevronDown,
  ChevronLeft, ChevronRight, Settings2, Cpu, ShieldCheck, TriangleAlert,
  RefreshCw, Layers, Pencil, Printer, Database, WandSparkles, Info,
  ArrowRight, Zap, LockKeyhole, GraduationCap, BriefcaseBusiness, FolderGit2,
  Award, BookOpen, Palette, Type, PanelsTopLeft, Wrench, UserRound, Search,
  Menu, PanelRight, LayoutDashboard, Send, type LucideIcon, type LucideProps,
} from "lucide-react";

// Shared line icons: explicit sizes remain available for document templates.
function icon(Component: LucideIcon) {
  return function AppIcon({ size = 18, strokeWidth = 1.75, ...props }: LucideProps) {
    return <Component size={size} strokeWidth={strokeWidth} aria-hidden="true" focusable="false" {...props} />;
  };
}

export const IconLogo = icon(FileText);
export const IconUpload = icon(Upload);
export const IconFile = icon(File);
export const IconClipboard = icon(ClipboardList);
export const IconSpark = icon(Sparkles);
export const IconTarget = icon(Target);
export const IconDownload = icon(Download);
export const IconTrash = icon(Trash2);
export const IconGrip = icon(GripVertical);
export const IconEye = icon(Eye);
export const IconEyeOff = icon(EyeOff);
export const IconPlus = icon(Plus);
export const IconX = icon(X);
export const IconCheck = icon(Check);
export const IconChevronUp = icon(ChevronUp);
export const IconChevronDown = icon(ChevronDown);
export const IconChevronLeft = icon(ChevronLeft);
export const IconChevronRight = icon(ChevronRight);
export const IconSettings = icon(Settings2);
export const IconCpu = icon(Cpu);
export const IconShield = icon(ShieldCheck);
export const IconAlert = icon(TriangleAlert);
export const IconRefresh = icon(RefreshCw);
export const IconLayers = icon(Layers);
export const IconEdit = icon(Pencil);
export const IconPrinter = icon(Printer);
export const IconDatabase = icon(Database);
export const IconWand = icon(WandSparkles);
export const IconInfo = icon(Info);
export const IconArrowRight = icon(ArrowRight);
export const IconZap = icon(Zap);
export const IconLock = icon(LockKeyhole);
export const IconGraduationCap = icon(GraduationCap);
export const IconBriefcase = icon(BriefcaseBusiness);
export const IconFolderGit = icon(FolderGit2);
export const IconAward = icon(Award);
export const IconBookOpen = icon(BookOpen);
export const IconPalette = icon(Palette);
export const IconType = icon(Type);
export const IconLayout = icon(PanelsTopLeft);
export const IconWrench = icon(Wrench);
export const IconUser = icon(UserRound);
export const IconSearch = icon(Search);
export const IconMenu = icon(Menu);
export const IconPanelRight = icon(PanelRight);
export const IconDashboard = icon(LayoutDashboard);
export const IconSend = icon(Send);
