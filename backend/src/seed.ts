import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { s3Service } from "./services/s3";

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seed...");

  // Clean existing data
  await prisma.codeArtifact.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.user.deleteMany();

  // Create demo users with initial credits
  const demoUser = await prisma.user.create({
    data: {
      email: "lakshmi@zocket.com",
      username: "Lakshmi",
      passwordHash: await bcrypt.hash("p6bF93]7=Xna", 10),
      credits: 20,
    },
  });

  const pythonCode = `import pandas as pd
import numpy as np
from typing import List, Dict, Any

class CSVProcessor:
    def __init__(self, file_path: str):
        self.file_path = file_path
        self.df = None
        
    def load_data(self) -> pd.DataFrame:
        """Load CSV data into a DataFrame"""
        try:
            self.df = pd.read_csv(self.file_path)
            print(f"✅ Loaded {len(self.df)} rows and {len(self.df.columns)} columns")
            return self.df
        except Exception as e:
            print(f"❌ Error loading CSV: {e}")
            return None
    
    def clean_data(self) -> pd.DataFrame:
        """Clean the data by handling missing values and duplicates"""
        if self.df is None:
            raise ValueError("No data loaded. Call load_data() first.")
            
        initial_rows = len(self.df)
        self.df = self.df.drop_duplicates()
        self.df = self.df.dropna()
        final_rows = len(self.df)
        print(f"🧹 Cleaned data: {initial_rows - final_rows} rows removed")
        return self.df
    
    def get_summary(self) -> Dict[str, Any]:
        """Get summary statistics of the data"""
        if self.df is None:
            raise ValueError("No data loaded. Call load_data() first.")
            
        return {
            'shape': self.df.shape,
            'columns': list(self.df.columns),
            'dtypes': self.df.dtypes.to_dict(),
            'missing_values': self.df.isnull().sum().to_dict(),
            'numeric_summary': self.df.describe().to_dict()
        }
    
    def export_data(self, output_path: str, data: pd.DataFrame = None) -> bool:
        """Export processed data to CSV"""
        try:
            df_to_export = data if data is not None else self.df
            df_to_export.to_csv(output_path, index=False)
            print(f"💾 Data exported to {output_path}")
            return True
        except Exception as e:
            print(f"❌ Error exporting data: {e}")
            return False

# Example usage
if __name__ == "__main__":
    processor = CSVProcessor("data.csv")
    df = processor.load_data()
    if df is not None:
        clean_df = processor.clean_data()
        summary = processor.get_summary()
        processor.export_data("processed_data.csv", clean_df)`;

  try {
    console.log("📤 Uploading Python code artifact to S3...");

    const pythonS3 = await s3Service.uploadCode(
      pythonCode,
      "python",
      "csv-processor"
    );

    await prisma.conversation.create({
      data: {
        title: "CSV Processor with Pandas",
        userId: demoUser.id,
        messages: {
          create: [
            {
              role: "USER",
              content: "Can you help me process CSV data with Pandas in Python?",
            },
            {
              role: "ASSISTANT",
              content:
                "Sure! Here's a full-featured Python class to load, clean, summarize, and export CSV data using pandas:",
              artifacts: {
                create: [
                  {
                    title: "CSV Processor",
                    language: "python",
                    type: "PYTHON",
                    s3Key: pythonS3.s3Key,
                    s3Url: pythonS3.s3Url,
                    fileSize: pythonS3.fileSize,
                  },
                ],
              },
            },
          ],
        },
      },
    });

    console.log("✅ Database seeded with Python code artifact.");
    console.log(`🔐 Login credentials: lakshmi@zocket.com / p6bF93]7=Xna`);
  } catch (error) {
    console.error("❌ Error during S3 operations:", error);
    console.log("⚠️  S3 upload failed - seeding only basic data");

    await prisma.conversation.create({
      data: {
        title: "CSV Processing (no artifact)",
        userId: demoUser.id,
        messages: {
          create: [
            {
              role: "ASSISTANT",
              content:
                "Here's how to handle CSV files with pandas in Python. Let me know if you want the full code!",
            },
          ],
        },
      },
    });
  }
}

main()
  .catch((e) => {
    console.error("❌ Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });