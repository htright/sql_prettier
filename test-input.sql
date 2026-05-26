/************************************************************
 설  명 - 데이터-자금일보출력_fst : 출력 조회
 작성일 - 20131207
 작성자 - 마스터
 수정일 - 20140430 미승인포함여부 추가
************************************************************/
ALTER PROC [dbo].fst_SAPCashDailyReportPrint_TESTHT

    @xmlDocument    NVARCHAR(MAX),

    @xmlFlags       INT = 0,

    @ServiceSeq     INT = 0,

    @WorkingTag     NVARCHAR(10) = '',

    @CompanySeq     INT = 0,

    @LanguageSeq    INT = 1,

    @UserSeq        INT = 0,

    @PgmSeq         INT = 0

AS

    DECLARE @docHandle      INT,

            @AccUnit        INT,

            @AccDate        NVARCHAR(8),

            @SMAccStd       INT,

   @BitCnt         INT,

            @FrYM           NCHAR(6),

            @ToYM           NCHAR(6),

            @BfrYM          NCHAR(6),

            @FrYMBfr        NCHAR(6),

            @ToYMBfr        NCHAR(6),

            @IsTrn          NCHAR(1),

            @SystemOpenYM   NCHAR(6),

            @TaxNoMask      NVARCHAR(30),

   @RemSeq   INT,

   @RemValSeq   INT,

   @AccSeq   INT,

   @AccDateTo  NVARCHAR(8),

            @FSItemTypeSeq  INT,

            @EnvValue       NVARCHAR(500),   --예산편성단위

            @CashEnvValue   NCHAR(1),        --출납(잔액기준)사용여부

            @KORDecimal     INT,

   @EmpName  NVARCHAR(100),

   @USDExRate  DECIMAL(19,5),

   @JPYExRate  DECIMAL(19,5),

   @CNYExRate  DECIMAL(19,5),  -- 20210525 sklee2103 추가

   @EURExRate  DECIMAL(19,5),  -- 20230921 sklee2103 추가

   @SMIsSet  INT,

   @SMIsExecute INT

    SELECT @KORDecimal = ISNULL(EnvValue, '') FROM _TCOMEnv WHERE CompanySeq = @CompanySeq AND EnvSeq = 15

    IF @@ROWCOUNT = 0 SELECT @KORDecimal = '0' --(mypark 2011.10.24 추가)
    EXEC sp_xml_preparedocument @docHandle OUTPUT, @xmlDocument

    SELECT  @AccUnit        = ISNULL(AccUnit        , 0),
            @AccDate        = ISNULL(AccDate        , ''),
   @SMIsSet  = ISNULL(SMIsSet  , 0),
   @SMIsExecute = ISNULL(SMIsExecute , 0)
      FROM OPENXML(@docHandle, N'/ROOT/DataBlock1', @xmlFlags)
      WITH (AccUnit         INT,
            AccDate         NVARCHAR(8),
   SMIsSet   INT,
   SMIsExecute  INT)

 SELECT @EmpName = B.EmpName
 FROM _TCAUser AS A
 JOIN _TDAEmp AS B WITH(NOLOCK) ON B.CompanySeq = A.CompanySeq
          AND B.EmpSeq = A.EmpSeq
 WHERE A.CompanySeq = @CompanySeq
   AND A.UserSeq = @UserSeq

     CASE WHEN MAX(acc.SMDrOrCr) = 1 THEN ISNULL(SUM(A.DrAmt),0) ELSE ISNULL(SUM(A.CrAmt),0) END AS InAmt,--입금
     CASE WHEN MAX(acc.SMDrOrCr) = 1 THEN ISNULL(SUM(A.CrAmt),0) ELSE ISNULL(SUM(A.DrAmt),0) END AS OutAmt--출금
 FROM #SlipSum AS A
 WHERE ISSUM = '1'
