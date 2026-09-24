import type { PrismaClientOrTransaction } from "../../lib/prisma.types";

class HealthRepository {
  probeDatabase(db: PrismaClientOrTransaction) {
    return db.$queryRaw`SELECT 1`;
  }
}

export default new HealthRepository();
