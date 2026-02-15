export default async function handler(req, res) {
  let { summonerName, tagLine } = req.query;
  const API_KEY = process.env.RIOT_API_KEY;

  if (!API_KEY) {
      return res.status(200).json({ error: 'no_key', tier: "설정오류", record: "Vercel 환경변수 확인!" });
  }

  const headers = { "X-Riot-Token": API_KEY };

  try {
    // [유니] 경고 메시지가 추천한 최신 URL 생성 방식을 사용해!
    // 1. 계정 정보 조회 (Asia 서버)
    const accountBaseUrl = "https://asia.api.riotgames.com/riot/account/v1/accounts/by-game-name/";
    const accountUrl = new URL(`${encodeURIComponent(summonerName.trim())}/${encodeURIComponent(tagLine.trim().replace('#',''))}`, accountBaseUrl);
    accountUrl.searchParams.append("api_key", API_KEY);

    const accountRes = await fetch(accountUrl.toString());
    
    // 여기서 Forbidden(403)이 난다면 100% API 키 문제야!
    if (accountRes.status === 403) {
        return res.status(200).json({ error: 'forbidden', tier: "접근거부", record: "API 키 새로 갱신해줘 오빠!" });
    }

    const accountData = await accountRes.json();
    if (!accountData.puuid) return res.status(200).json({ error: 'not_found', tier: "미검색", record: "닉네임/태그 확인 요망" });

    const puuid = accountData.puuid;

    // 2. 소환사 정보 조회 (KR 서버)
    const summonerRes = await fetch(`https://kr.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`, { headers });
    const summonerData = await summonerRes.json();
    const id = summonerData.id;

    // 3. 리그 전적 조회 (KR 서버)
    const leagueRes = await fetch(`https://kr.api.riotgames.com/lol/league/v4/entries/by-summoner/${id}`, { headers });
    const leagueData = await leagueRes.json();
    
    let tierInfo = "UNRANKED", record = "전적 없음";
    if (Array.isArray(leagueData) && leagueData.length > 0) {
        const target = leagueData.find(e => e.queueType === 'RANKED_SOLO_5x5') || leagueData[0];
        tierInfo = `${target.tier} ${target.rank}`;
        record = `${target.wins}승 ${target.losses}패`;
    }

    // 4. 인게임 정보 조회
    let gameData = { error: 'not_in_game' };
    const gameRes = await fetch(`https://kr.api.riotgames.com/lol/spectator/v5/active-games/by-summoner/${puuid}`, { headers });
    if (gameRes.ok) {
        const live = await gameRes.json();
        gameData = { ...live, error: null };
    }

    res.status(200).json({ ...gameData, tier: tierInfo, record: record });

  } catch (error) {
    res.status(200).json({ error: 'server_error', tier: "에러", record: error.message });
  }
}
