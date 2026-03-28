export class UsernameService {
    async changeUsername(userId: string, newHandle: string) {
      const user = await db.user.findUnique({ where: { id: userId } });
      
      // 1. Validation Check
      const validation = validateUsername(newHandle);
      if (!validation.valid) throw new Error(validation.error);
  
      // 2. Cooldown Check (30 Days)
      const lastChange = await db.usernameHistory.findFirst({
        where: { userId },
        orderBy: { changedAt: 'desc' }
      });
  
      if (lastChange) {
        const daysSince = (Date.now() - lastChange.changedAt.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince < 30) throw new Error(`Cooldown active. Wait ${Math.ceil(30 - daysSince)} more days.`);
      }
  
      // 3. Sync to Soroban Contract
      try {
        await sorobanService.updateUserHandle(user.walletAddress, newHandle);
      } catch (err) {
        throw new Error("Failed to sync username to blockchain.");
      }
  
      // 4. Update DB & Log History
      return await db.$transaction([
        db.usernameHistory.create({
          data: { userId, oldUsername: user.username, newUsername: newHandle, changedAt: new Date() }
        }),
        db.user.update({
          where: { id: userId },
          data: { username: newHandle }
        })
      ]);
    }
  }
  