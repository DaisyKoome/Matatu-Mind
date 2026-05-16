export const KNOWLEDGE_BASE = {
  termini: [
    {
      name: "Green Park Terminus",
      location: "Former Lunar Park site, off Uhuru Highway near Railways",
      routes: ["111 (Ngong)", "24 (Karen)", "125 (Rongai)", "126 (Kiserian)", "Lang'ata Road routes", "Argwings Kodhek Road routes"]
    },
    {
      name: "Desai and Park Road Termini",
      location: "Desai Road and Park Road junction, Eastlands",
      routes: ["Long-distance PSVs from Mt Kenya (Nyeri, Karatina, Embu)"]
    },
    {
      name: "Muthurwa Market Terminus",
      location: "Along Landhies Road, Muthurwa area",
      routes: ["Jogoo Road", "Eastlands routes (Donholm, Kayole, Umoja)"]
    },
    {
      name: "Bunyala and Workshop Roads Terminus",
      location: "Junction of Bunyala Road and Workshop Road, Industrial Area",
      routes: ["Mombasa Road routes (South B, South C)", "Industrial Area", "Imara Daima", "Athi River", "Kitengela", "Machakos"]
    }
  ],
  majorStages: [
    { name: "Railways Terminus", location: "Haile Selassie Avenue", serves: ["Ngong", "Karen", "Rongai", "Kitengela", "Kiserian", "Kikuyu", "Kawangware", "Kibera"] },
    { name: "Kencom Stage", location: "City Hall Way", serves: ["Riruta", "Kibera", "Ngong Road routes"] },
    { name: "OTC (Open Trade Center)", location: "Haile Selassie Avenue", serves: ["Buru Buru", "Donholm", "Pipeline", "Kayole", "Komarock", "Dandora", "Umoja"] },
    { name: "Odeon/Koja Stage", location: "Moi Avenue", serves: ["Juja", "Ruiru", "Kahawa", "Githurai", "Kenyatta University"] },
    { name: "Afya Centre Stage", location: "Aga Khan Road", serves: ["Upper Hill", "Kilimani"] },
    { name: "Ambassador/Archives Stage", location: "Moi Avenue", serves: ["Upper Hill", "Kilimani", "Kawangware", "Kenyatta Hospital"] }
  ],
  routes: [
    { id: "100", destination: "Kiambu", line: "A" },
    { id: "120", destination: "Githunguri", line: "A" },
    { id: "17B", destination: "Mwiki", line: "B/F" },
    { id: "45", destination: "Githurai", line: "B" },
    { id: "145", destination: "Ruiru Town", line: "B" },
    { id: "6", destination: "Eastleigh", line: "C" },
    { id: "46", destination: "Kawangware / Yaya", line: "L" },
    { id: "111", destination: "Ngong", line: "J" },
    { id: "24", destination: "Karen", line: "J" },
    { id: "105", destination: "Kikuyu", line: "O" },
    { id: "58", destination: "Buruburu", line: "D" },
    { id: "33", destination: "Ngumo / South B / Utawala", line: "J/H" }
  ],
  fares: {
    cbd: "Ksh 30 - 50",
    estates: "Ksh 50 - 100",
    outer: "Ksh 80 - 200"
  }
};
