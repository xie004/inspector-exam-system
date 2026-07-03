import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('开始初始化种子数据...');

  // 1. 清理现有数据 (按外键依赖逆序清理)
  await prisma.answer.deleteMany({});
  await prisma.examRecord.deleteMany({});
  await prisma.examTask.deleteMany({});
  await prisma.question.deleteMany({});
  await prisma.exam.deleteMany({});
  await prisma.standard.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.department.deleteMany({});
  await prisma.aiConfig.deleteMany({});

  console.log('数据清理完成。');

  // 2. 创建部门
  const depChem = await prisma.department.create({
    data: { name: '化学检测部' },
  });
  const depPhys = await prisma.department.create({
    data: { name: '物理检测部' },
  });
  const depElec = await prisma.department.create({
    data: { name: '电子电器检测部' },
  });

  console.log('部门创建完成。');

  // 3. 准备密码哈希
  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  const creatorPasswordHash = await bcrypt.hash('creator123', 10);
  const examineePasswordHash = await bcrypt.hash('examinee123', 10);

  // 4. 创建管理员账户
  await prisma.user.create({
    data: {
      username: 'admin',
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
      realName: '系统管理员',
      employeeId: 'ADMIN001',
      status: 'ACTIVE',
    },
  });

  // 5. 创建化学检测部出题员
  await prisma.user.create({
    data: {
      username: 'creator',
      passwordHash: creatorPasswordHash,
      role: 'CREATOR',
      realName: '化学出题员',
      employeeId: 'CREATOR001',
      departmentId: depChem.id,
      sectionName: '理化分析组',
      status: 'ACTIVE',
    },
  });

  // 6. 创建化学检测部考生
  await prisma.user.create({
    data: {
      username: 'examinee',
      passwordHash: examineePasswordHash,
      role: 'EXAMINEE',
      realName: '检测员小张',
      employeeId: 'CHEM001',
      departmentId: depChem.id,
      sectionName: '色谱分析科',
      status: 'ACTIVE',
    },
  });

  // 7. 创建默认的 AI 配置 (空 Key，由管理员登录后配置)
  await prisma.aiConfig.create({
    data: {
      id: 'default',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: '',
      modelName: 'gpt-4o',
    },
  });

  console.log('种子数据初始化成功！');
  console.log('初始账户信息：');
  console.log('1. 管理员: admin / admin123 (工号: ADMIN001)');
  console.log('2. 化学出题员: creator / creator123 (工号: CREATOR001)');
  console.log('3. 考生小张: examinee / examinee123 (工号: CHEM001)');
}

main()
  .catch((e) => {
    console.error('种子数据初始化失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
