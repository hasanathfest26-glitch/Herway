import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { BookingsModule } from './bookings/bookings.module';
import { BuddiesModule } from './buddies/buddies.module';
import { getJwtSecret } from './common/config/env.validation';
import { ObservabilityInterceptor } from './common/observability/observability.interceptor';
import { PrismaModule } from './common/prisma/prisma.module';
import { StorageModule } from './common/storage/storage.module';
import { ContactsModule } from './contacts/contacts.module';
import { EmergencyModule } from './emergency/emergency.module';
import { LocationsModule } from './locations/locations.module';
import { NotificationsModule } from './notifications/notifications.module';
import { RealtimeModule } from './realtime/realtime.module';
import { SafeHavensModule } from './safe-havens/safe-havens.module';
import { TripsModule } from './trips/trips.module';
import { UsersModule } from './users/users.module';
import { VerificationModule } from './verification/verification.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    JwtModule.registerAsync({
      global: true,
      useFactory: () => ({
        secret: getJwtSecret(),
      }),
    }),
    PrismaModule,
    RealtimeModule,
    StorageModule,
    NotificationsModule,
    AuthModule,
    UsersModule,
    VerificationModule,
    BuddiesModule,
    BookingsModule,
    TripsModule,
    LocationsModule,
    ContactsModule,
    SafeHavensModule,
    EmergencyModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ObservabilityInterceptor,
    },
  ],
})
export class AppModule {}
