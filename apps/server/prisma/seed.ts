/**
 * Hipparcos 카탈로그 시딩 스크립트
 *
 * 실행 전 준비:
 * 1. https://cdsarc.cds.unistra.fr/ftp/cats/I/239/hip_main.dat 다운로드
 * 2. 파일을 prisma/hip_main.dat 에 위치
 * 3. yarn db:seed 실행
 *
 * 필드 위치 (고정폭 형식):
 *   HIP      :  9-14 (Hipparcos ID)
 *   Vmag     : 42-46 (겉보기 등급)
 *   RArad    : 52-63 (적경, 라디안)
 *   DErad    : 64-75 (적위, 라디안)
 *   ProperName : 별도 파일 참조 (여기서는 null 처리)
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

const prisma = new PrismaClient();

const RAD_TO_DEG = 180 / Math.PI;
const MAGNITUDE_LIMIT = 6.5; // 육안 한계등급
const BATCH_SIZE = 1000;

async function seed() {
  const filePath = path.join(__dirname, 'hip_main.dat');

  if (!fs.existsSync(filePath)) {
    console.error('hip_main.dat 파일이 없습니다.');
    console.error('https://cdsarc.cds.unistra.fr/ftp/cats/I/239/hip_main.dat 에서 다운로드하세요.');
    process.exit(1);
  }

  console.log('Hipparcos 카탈로그 파싱 시작...');

  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({ input: fileStream });

  const stars: {
    hipId: number;
    ra: number;
    dec: number;
    magnitude: number;
    name: null;
  }[] = [];

  for await (const line of rl) {
    const hipStr = line.slice(8, 14).trim();
    const vmagStr = line.slice(41, 46).trim();
    const raRadStr = line.slice(51, 63).trim();
    const deRadStr = line.slice(64, 76).trim();

    if (!hipStr || !vmagStr || !raRadStr || !deRadStr) continue;

    const hipId = parseInt(hipStr, 10);
    const magnitude = parseFloat(vmagStr);
    const raRad = parseFloat(raRadStr);
    const deRad = parseFloat(deRadStr);

    if (isNaN(hipId) || isNaN(magnitude) || isNaN(raRad) || isNaN(deRad)) continue;
    if (magnitude > MAGNITUDE_LIMIT) continue;

    stars.push({
      hipId,
      ra: raRad * RAD_TO_DEG,
      dec: deRad * RAD_TO_DEG,
      magnitude,
      name: null,
    });
  }

  console.log(`파싱 완료: ${stars.length}개 별 (magnitude ≤ ${MAGNITUDE_LIMIT})`);
  console.log('DB 적재 시작...');

  // 배치 단위로 upsert
  for (let i = 0; i < stars.length; i += BATCH_SIZE) {
    const batch = stars.slice(i, i + BATCH_SIZE);
    await prisma.$transaction(
      batch.map((star) =>
        prisma.star.upsert({
          where: { hipId: star.hipId },
          create: star,
          update: star,
        }),
      ),
    );
    console.log(`  ${Math.min(i + BATCH_SIZE, stars.length)} / ${stars.length}`);
  }

  console.log('시딩 완료!');

  // 검증
  const total = await prisma.star.count();
  const mag5 = await prisma.star.count({ where: { magnitude: { lte: 5 } } });
  console.log(`\n검증:`);
  console.log(`  전체: ${total}개`);
  console.log(`  magnitude ≤ 5: ${mag5}개 (API 기본값 필터 대상)`);
}

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
