import {
  CheckIcon as LucideCheckIcon,
  ChevronDownIcon as LucideChevronDownIcon,
  ChevronLeftIcon as LucideChevronLeftIcon,
  ChevronRightIcon as LucideChevronRightIcon,
  ChevronUpIcon as LucideChevronUpIcon,
  PlusIcon as LucidePlusIcon,
  Trash2Icon as LucideTrash2Icon,
  XIcon as LucideXIcon,
} from "lucide-react";

import { createIcon } from "./icon";

export const PlusIcon = createIcon(LucidePlusIcon);
export const TrashIcon = createIcon(LucideTrash2Icon);
export const CheckIcon = createIcon(LucideCheckIcon);
export const CloseIcon = createIcon(LucideXIcon);
export const ChevronLeftIcon = createIcon(LucideChevronLeftIcon);
export const ChevronRightIcon = createIcon(LucideChevronRightIcon);
export const ChevronUpIcon = createIcon(LucideChevronUpIcon);
export const ChevronDownIcon = createIcon(LucideChevronDownIcon);
