export class ProjectionPeriod {
  days!: number;
  projectedYieldUsdc!: string;
}

export class ProjectionsDto {
  currentStakedUsdc!: string;
  additionalStakeUsdc!: string;
  currentApyPercent!: string;
  projections!: ProjectionPeriod[];
}
