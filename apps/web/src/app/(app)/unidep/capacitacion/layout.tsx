import { TrainingAccessProvider } from "@/components/capacitacion/TrainingAccessProvider";

export default function UnidepCapacitacionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <TrainingAccessProvider>{children}</TrainingAccessProvider>;
}
