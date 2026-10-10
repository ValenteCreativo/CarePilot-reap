import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function CaseCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-5 w-20" />
        </div>
        <Skeleton className="h-4 w-24 mt-2" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-4 w-48" />
      </CardContent>
    </Card>
  );
}

export default function Loading() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-5 w-60 mt-1" />
        </div>
        <Skeleton className="h-10 w-36" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <CaseCardSkeleton />
        <CaseCardSkeleton />
        <CaseCardSkeleton />
      </div>
    </div>
  );
}
