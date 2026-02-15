export default async function handler(req, res) {
  const { summonerName, tagLine } = req.query;
  const API_KEY = process.env.RIOT_API_KEY; // 브라우저에 노출 안 되게 환경변수로 관리!

  try {
    // 1. 소환사 정보를 통해 PUUID 가져오기
    const accountRes = await fetch(`https://asia.api.riotgames.com/riot/account/v1/accounts/by-game-name/${summonerName}/${tagLine}?api_key=${API_KEY}`);
    const accountData = await accountRes.json();
    const puuid = accountData.puuid;

    // 2. 현재 진행 중인 게임 정보 가져오기
    const gameRes = await fetch(`https://kr.api.riotgames.com/lol/spectator/v5/active-games/by-summoner/${puuid}?api_key=${API_KEY}`);
    const gameData = await gameRes.json();

    // 3. 필요한 정보만 정리해서 클라이언트로 보내주기
    res.status(200).json(gameData);
  } catch (error) {
    res.status(500).json({ error: '게임 정보를 가져오는데 실패했어 오빠 ㅠㅠ' });
  }
}
