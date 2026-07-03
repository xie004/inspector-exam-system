const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

async function run() {
  console.log("=== START DATABASE EMPIRICAL TESTS ===");
  try {
    // 1. Test case sensitivity in SQLite for exam title
    console.log("\n1. Testing title uniqueness & case-sensitivity...");
    
    // Get an existing department to use as departmentId
    const dept = await db.department.findFirst();
    if (!dept) {
      console.error("No department found. Cannot run test.");
      return;
    }
    console.log(`Using Department ID: ${dept.id} (${dept.name})`);

    const title1 = "TEST_UNIQUE_EXAM_TITLE_" + Date.now();
    const title2 = title1.toLowerCase();

    console.log(`Creating first exam with title: "${title1}"`);
    const exam1 = await db.exam.create({
      data: {
        title: title1,
        departmentId: dept.id,
        timeLimit: 60,
      }
    });
    console.log(`Successfully created Exam 1. ID: ${exam1.id}`);

    // Try creating duplicate exact title
    console.log(`Creating duplicate exact exam with title: "${title1}"`);
    try {
      const examDuplicate = await db.exam.create({
        data: {
          title: title1,
          departmentId: dept.id,
          timeLimit: 60,
        }
      });
      console.log(`WARNING: Database allowed duplicate exact title! ID: ${examDuplicate.id}`);
      await db.exam.delete({ where: { id: examDuplicate.id } });
    } catch (e) {
      console.log(`Database blocked duplicate exact title: ${e.message}`);
    }

    // Try finding via lowercase title
    console.log(`Searching for lowercase title "${title2}" using findFirst...`);
    const foundLower = await db.exam.findFirst({
      where: { title: title2 }
    });
    if (foundLower) {
      console.log(`MATCH FOUND (Case-Insensitive in SQLite)! ID: ${foundLower.id}`);
    } else {
      console.log(`NO MATCH FOUND (Case-Sensitive in SQLite)`);
    }

    // Clean up
    await db.exam.delete({ where: { id: exam1.id } });
    console.log("Cleaned up exam1.");

    // 2. Test standard select prepopulate logic simulator
    console.log("\n2. Testing Standard title retrieval for pre-population...");
    const std = await db.standard.findFirst();
    if (std) {
      console.log(`First standard in DB: ID="${std.id}", Title="${std.title}"`);
      console.log(`Pre-population simulator: title set to "${std.title}" -> PASS`);
    } else {
      console.log("No standards in DB to test pre-population.");
    }

  } catch (error) {
    console.error("Error during database tests:", error);
  } finally {
    await db.$disconnect();
    console.log("\n=== END DATABASE EMPIRICAL TESTS ===");
  }
}

run();
