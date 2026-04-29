import { useViewModel } from "@/lib/view-model";
import { initialIndexViewState, make } from "./index.view-model";

export const useIndexViewModel = () => useViewModel(make, initialIndexViewState);
