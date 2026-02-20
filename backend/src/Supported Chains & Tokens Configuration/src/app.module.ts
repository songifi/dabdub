import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConfigModule as NestConfigModule } from "@nestjs/config";
import { ConfigModule } from "./config/config.module";
import { typeormConfig } from "./config";

@Module({
  imports: [
    NestConfigModule.forRoot({
      envFilePath: ".env",
      isGlobal: true,
    }),
    TypeOrmModule.forRoot(typeormConfig),
    ConfigModule,
  ],
})
export class AppModule {}
